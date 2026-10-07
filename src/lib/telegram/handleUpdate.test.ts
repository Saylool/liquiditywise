import { describe, expect, it } from "vitest";

import { getDictionary } from "../i18n/dictionaries";
import type { BotClient } from "./botApi";
import { fakeStore } from "./fakeStore";
import { handleUpdate } from "./handleUpdate";
import { claimLink, createPendingLink, readLink, recordDigestSent, setSmartAlerts } from "./links";
import { poolWatchedText, poolWatchesText } from "./messages";
import type { PoolWatchTarget } from "./poolWatchCommand";
import type { PoolRangeReading } from "./poolRangeShift";
import { POOL_WATCHERS_KEY, readPoolWatches } from "./poolWatches";
import type { TelegramUpdate } from "./update";

const TOKEN = "abcDEF123456789012_-xy";
const ADDRESS = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";

const fakeBot = () => {
  const sent: { chatId: number; text: string }[] = [];
  const bot: BotClient = {
    sendMessage: async (chatId, text) => {
      sent.push({ chatId, text });
      return true;
    },
  };
  return { bot, sent };
};

const message = (text: string, chatId = 42, language = "tr", type = "private"): TelegramUpdate => ({
  update_id: 1,
  message: { chat: { id: chatId, type }, from: { language_code: language }, text },
});

/* No pool can be read unless a test says so: the position commands under test never read one. */
const noPools = { readPoolRange: async () => null, now: () => new Date("2026-10-07T12:00:00.000Z") };

const setup = async () => {
  const store = fakeStore();
  await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "de", now: new Date() });
  const { bot, sent } = fakeBot();
  return { store, bot, sent, handling: { store, bot, dictionary: getDictionary, ...noPools } };
};

describe("handleUpdate", () => {
  it("claims the link on /start and answers in the language the site recorded", async () => {
    const { handling, sent, store } = await setup();
    await handleUpdate(message(`/start ${TOKEN}`), handling);

    expect((await readLink(store, TOKEN))?.chatId).toBe(42);
    expect(sent).toEqual([{ chatId: 42, text: getDictionary("de").telegram.linked(ADDRESS) }]);
  });

  it("answers an unknown token in the sender's own language", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message("/start zyxWVU987654321098_-ab", 42, "es"), handling);
    expect(sent).toEqual([{ chatId: 42, text: getDictionary("es").telegram.unknownStart }]);
  });

  it("refuses a token a different chat already claimed", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 7);
    await handleUpdate(message(`/start ${TOKEN}`, 42, "en"), handling);
    expect(sent).toEqual([{ chatId: 42, text: getDictionary("en").telegram.alreadyClaimed }]);
    expect((await readLink(store, TOKEN))?.chatId).toBe(7);
  });

  it("forgets the link on /stop, and says so in the link's language", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 42);
    await handleUpdate(message("/stop", 42, "en"), handling);

    expect(await readLink(store, TOKEN)).toBeNull();
    expect(sent).toEqual([{ chatId: 42, text: getDictionary("de").telegram.stopped }]);
  });

  it("tells a chat that follows nothing that there is nothing to stop", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message("/stop", 99, "hi"), handling);
    expect(sent).toEqual([{ chatId: 99, text: getDictionary("hi").telegram.nothingToStop }]);
  });

  it("answers anything else with the help line, and a bare /start too", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message("hello there", 42, "zh"), handling);
    await handleUpdate(message("/start", 42, "zh"), handling);
    await handleUpdate(message("/help", 42, "zh"), handling);
    expect(sent.map((item) => item.text)).toEqual(Array(3).fill(getDictionary("zh").telegram.help));
  });

  it("falls back to English for a language it does not publish", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message("hello", 42, "fi"), handling);
    expect(sent[0]?.text).toBe(getDictionary("en").telegram.help);
  });

  it("ignores anything that is not a private chat, and updates without a message", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message(`/start ${TOKEN}`, 42, "tr", "group"), handling);
    await handleUpdate({ update_id: 3 }, handling);
    expect(sent).toEqual([]);
  });

  it("says the store is down rather than that the link is unknown", async () => {
    const { handling, sent, store } = await setup();
    store.down = true;
    await handleUpdate(message(`/start ${TOKEN}`, 42, "en"), handling);
    await handleUpdate(message("/stop", 42, "en"), handling);
    expect(sent.map((item) => item.text)).toEqual(Array(2).fill(getDictionary("en").telegram.storeDown));
  });
});

describe("handleUpdate and /smart", () => {
  it("turns the alerts on for the chat's link, says so in the link's language, and off again on the next ask", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 42);

    await handleUpdate(message("/smart", 42, "en"), handling);
    expect((await readLink(store, TOKEN))?.smart).toEqual({ ranges: {} });
    await handleUpdate(message("/smart", 42, "en"), handling);
    expect((await readLink(store, TOKEN))?.smart).toBeUndefined();

    expect(sent).toEqual([
      { chatId: 42, text: getDictionary("de").telegram.smartOn },
      { chatId: 42, text: getDictionary("de").telegram.smartOff },
    ]);
  });

  it("tells a chat that follows nothing to connect first, in the sender's language, and changes nothing", async () => {
    const { handling, sent, store } = await setup();
    await handleUpdate(message("/smart", 99, "es"), handling);

    expect(sent).toEqual([{ chatId: 99, text: getDictionary("es").telegram.smartNoLink }]);
    expect((await readLink(store, TOKEN))?.smart).toBeUndefined();
  });

  it("says the store is down when it is, and when it did not take the change", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 42);
    store.down = true;
    await handleUpdate(message("/smart", 42, "tr"), handling);

    expect(sent[0]?.text).toBe(getDictionary("tr").telegram.storeDown);
  });

  it("does not leave the link's other fields behind when it turns on", async () => {
    const { handling, store } = await setup();
    await claimLink(store, TOKEN, 42);
    await handleUpdate(message("/smart", 42, "en"), handling);

    expect(await readLink(store, TOKEN)).toMatchObject({ address: ADDRESS, chatId: 42, locale: "de" });
  });
});

describe("handleUpdate and /weekly", () => {
  it("turns the digest on for the chat's link, says so in the link's language, and off again on the next ask", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 42);

    await handleUpdate(message("/weekly", 42, "en"), handling);
    expect((await readLink(store, TOKEN))?.weekly).toEqual({ sentAt: null });
    await handleUpdate(message("/weekly", 42, "en"), handling);
    expect((await readLink(store, TOKEN))?.weekly).toBeUndefined();

    expect(sent).toEqual([
      { chatId: 42, text: getDictionary("de").telegram.weeklyOn },
      { chatId: 42, text: getDictionary("de").telegram.weeklyOff },
    ]);
  });

  it("deletes the time of the last digest when turned off, and leaves /smart as it was", async () => {
    const { handling, store } = await setup();
    await claimLink(store, TOKEN, 42);
    await setSmartAlerts(store, TOKEN, (await readLink(store, TOKEN)) as never, true);
    await handleUpdate(message("/weekly", 42, "en"), handling);
    await recordDigestSent(store, TOKEN, (await readLink(store, TOKEN)) as never, new Date("2026-10-05T08:00:00.000Z"));
    await handleUpdate(message("/weekly", 42, "en"), handling);

    const raw = store.data.get(`liquiditywise:telegram:link:${TOKEN}`) ?? "";
    expect(raw).not.toContain("weekly");
    expect(raw).not.toContain("2026-10-05");
    expect((await readLink(store, TOKEN))?.smart).toEqual({ ranges: {} });
  });

  it("tells a chat that follows nothing to connect first, in the sender's language, and stores nothing", async () => {
    const { handling, sent, store } = await setup();
    await handleUpdate(message("/weekly", 99, "ru"), handling);

    expect(sent).toEqual([{ chatId: 99, text: getDictionary("ru").telegram.smartNoLink }]);
    expect((await readLink(store, TOKEN))?.weekly).toBeUndefined();
  });

  it("says the store is down when it is", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 42);
    store.down = true;
    await handleUpdate(message("/weekly", 42, "pt"), handling);

    expect(sent).toEqual([{ chatId: 42, text: getDictionary("pt").telegram.storeDown }]);
  });

  it("says the store is down, in the link's language, when it did not take the change", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 42);
    const failing = { ...store, set: async () => false };
    await handleUpdate(message("/weekly", 42, "en"), { ...handling, store: failing });

    expect(sent).toEqual([{ chatId: 42, text: getDictionary("de").telegram.storeDown }]);
    expect((await readLink(store, TOKEN))?.weekly).toBeUndefined();
  });
});

describe("handleUpdate and the pool watches", () => {
  const V3 = `0x${"c".repeat(40)}`;
  const V4 = `0x${"d".repeat(64)}`;
  const NOW = new Date("2026-10-07T12:00:00.000Z");

  /** WETH per USDC 0.0003 to 0.0005, which the message quotes as USDC per WETH. */
  const reading = (target: PoolWatchTarget, range: readonly [number, number] = [0.0003, 0.0005]): PoolRangeReading => ({
    ...target,
    pair: { token0: "USDC", token1: "WETH" },
    lpFeePpm: 500,
    currentPrice: 0.0004,
    range,
  });

  /** A reader that answers every pool the same way and remembers what it was asked. */
  const reader = (answer: (target: PoolWatchTarget) => Promise<PoolRangeReading | null> = async (target) => reading(target)) => {
    const asked: PoolWatchTarget[] = [];
    const readPoolRange = async (target: PoolWatchTarget) => {
      asked.push(target);
      return answer(target);
    };
    return { asked, readPoolRange };
  };

  const watching = async () => {
    const base = await setup();
    const { asked, readPoolRange } = reader();
    return { ...base, asked, handling: { ...base.handling, readPoolRange, now: () => NOW } };
  };

  it("watches a pool for a chat with no link, answers with the range as read in the sender's language, and keeps the range as told", async () => {
    const { handling, sent, store, asked } = await watching();
    await handleUpdate(message(`/watch ${V3}`, 99, "tr"), handling);

    const target = { protocol: "v3", chainId: 1, poolId: V3 } as const;
    expect(asked).toEqual([target]);
    expect(sent).toEqual([{ chatId: 99, text: poolWatchedText(reading(target), getDictionary("tr"), "tr") }]);
    expect(await readPoolWatches(store, 99)).toEqual({
      locale: "tr",
      watches: [{ chainId: 1, protocol: "v3", poolId: V3, told: { lower: 0.0003, upper: 0.0005, at: NOW.toISOString() } }],
    });
    expect(await store.smembers(POOL_WATCHERS_KEY)).toEqual(["99"]);
  });

  it("takes the chain before or after the pool, and a v4 id as a v4 pool", async () => {
    const { handling, store, asked } = await watching();
    await handleUpdate(message(`/watch base ${V3}`, 99, "en"), handling);
    await handleUpdate(message(`/watch ${V4} unichain`, 99, "en"), handling);

    expect(asked).toEqual([
      { protocol: "v3", chainId: 8453, poolId: V3 },
      { protocol: "v4", chainId: 130, poolId: V4 },
    ]);
    expect((await readPoolWatches(store, 99))?.watches.map(({ chainId, protocol }) => [chainId, protocol])).toEqual([
      [8453, "v3"],
      [130, "v4"],
    ]);
  });

  it("answers bad input with what was wrong, in the sender's language, and reads and stores nothing", async () => {
    const { handling, sent, store, asked } = await watching();
    const t = getDictionary("es").telegram;
    await handleUpdate(message("/watch", 99, "es"), handling);
    await handleUpdate(message("/watch 0x1234", 99, "es"), handling);
    await handleUpdate(message(`/watch solana ${V3}`, 99, "es"), handling);
    await handleUpdate(message(`/watch unichain ${V3}`, 99, "es"), handling);

    expect(sent.map(({ text }) => text)).toEqual([
      t.watchHow,
      t.watchHow,
      t.watchUnknownChain("solana", "ethereum, base, arbitrum, unichain, optimism, polygon, bnb, avalanche, celo"),
      t.watchNotOnChain("Uniswap v3", "Unichain"),
    ]);
    expect(asked).toEqual([]);
    expect(store.data.size).toBe(1);
  });

  it("stores nothing for a pool that could not be read, or whose read threw, and says so", async () => {
    const { handling, sent, store } = await watching();
    await handleUpdate(message(`/watch ${V3}`, 99, "en"), { ...handling, readPoolRange: async () => null });
    await handleUpdate(message(`/watch ${V3}`, 99, "en"), {
      ...handling,
      readPoolRange: async () => {
        throw new Error("https://secret-rpc.example/key timed out");
      },
    });

    expect(sent.map(({ text }) => text)).toEqual(Array(2).fill(getDictionary("en").telegram.watchUnreadable));
    expect(await readPoolWatches(store, 99)).toBeNull();
    expect(await store.smembers(POOL_WATCHERS_KEY)).toEqual([]);
  });

  it("holds a chat to five pools, and says so with the number", async () => {
    const { handling, sent, store } = await watching();
    for (let n = 1; n <= 6; n += 1) await handleUpdate(message(`/watch 0x${String(n).padStart(40, "0")}`, 99, "en"), handling);

    expect((await readPoolWatches(store, 99))?.watches).toHaveLength(5);
    expect(sent[5]?.text).toBe(getDictionary("en").telegram.watchFull("5"));
  });

  it("unwatches one pool, says so, and tells a chat that did not watch it so too", async () => {
    const { handling, sent, store } = await watching();
    await handleUpdate(message(`/watch base ${V3}`, 99, "en"), handling);
    await handleUpdate(message(`/watch ${V4}`, 99, "en"), handling);
    await handleUpdate(message(`/unwatch ${V3} base`, 99, "en"), handling);
    await handleUpdate(message(`/unwatch ${V3}`, 99, "en"), handling);

    expect(sent.slice(2).map(({ text }) => text)).toEqual([getDictionary("en").telegram.unwatched, getDictionary("en").telegram.notWatched]);
    expect((await readPoolWatches(store, 99))?.watches.map(({ poolId }) => poolId)).toEqual([V4]);
  });

  it("deletes the record and leaves the set when the last pool is unwatched", async () => {
    const { handling, store } = await watching();
    await handleUpdate(message(`/watch ${V3}`, 99, "en"), handling);
    await handleUpdate(message(`/unwatch ${V3}`, 99, "en"), handling);

    expect(await readPoolWatches(store, 99)).toBeNull();
    expect(await store.smembers(POOL_WATCHERS_KEY)).toEqual([]);
  });

  it("lists what the chat watches, read afresh, in the language the watches were made in", async () => {
    const { handling, sent, store } = await watching();
    await handleUpdate(message(`/watch ${V3}`, 99, "tr"), handling);
    await handleUpdate(message("/watches", 99, "en"), handling);

    const record = await readPoolWatches(store, 99);
    const target = { protocol: "v3", chainId: 1, poolId: V3 } as const;
    expect(sent[1]?.text).toBe(poolWatchesText([{ watch: record!.watches[0]!, reading: reading(target) }], getDictionary("tr"), "tr"));
    expect(sent[1]?.text).toContain("USDC/WETH");
  });

  it("tells a chat with no watches that it has none, in the sender's language", async () => {
    const { handling, sent } = await watching();
    await handleUpdate(message("/watches", 99, "pt"), handling);
    expect(sent).toEqual([{ chatId: 99, text: getDictionary("pt").telegram.watchesNone }]);
  });

  it("deletes the pool watches on /stop along with the link, and on their own when there is no link", async () => {
    const { handling, sent, store } = await watching();
    await claimLink(store, TOKEN, 42);
    await handleUpdate(message(`/watch ${V3}`, 42, "en"), handling);
    await handleUpdate(message(`/watch ${V3}`, 99, "ru"), handling);

    await handleUpdate(message("/stop", 42, "en"), handling);
    expect(await readLink(store, TOKEN)).toBeNull();
    expect(await readPoolWatches(store, 42)).toBeNull();
    expect(sent.at(-1)).toEqual({ chatId: 42, text: getDictionary("de").telegram.stopped });

    await handleUpdate(message("/stop", 99, "en"), handling);
    expect(await readPoolWatches(store, 99)).toBeNull();
    expect(await store.smembers(POOL_WATCHERS_KEY)).toEqual([]);
    /* In the language the watches were made in, as a link's /stop speaks the link's. */
    expect(sent.at(-1)).toEqual({ chatId: 99, text: getDictionary("ru").telegram.stopped });

    await handleUpdate(message("/stop", 99, "en"), handling);
    expect(sent.at(-1)).toEqual({ chatId: 99, text: getDictionary("en").telegram.nothingToStop });
  });

  it("says the store is down rather than that nothing is watched", async () => {
    const { handling, sent, store } = await watching();
    store.down = true;
    await handleUpdate(message(`/watch ${V3}`, 99, "en"), handling);
    await handleUpdate(message(`/unwatch ${V3}`, 99, "en"), handling);
    await handleUpdate(message("/watches", 99, "en"), handling);

    expect(sent.map(({ text }) => text)).toEqual(Array(3).fill(getDictionary("en").telegram.storeDown));
  });
});
