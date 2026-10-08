import { describe, expect, it } from "vitest";

import { fakeStore } from "./fakeStore";
import { BACKUP_PREFIXES } from "../backup/storeBackup";
import type { KeyValueStore } from "../store/keyValueStore";
import {
  buildChatIndex,
  CHAT_INDEX_BUILT_KEY,
  claimLink,
  createPendingLink,
  findByChat,
  forgetChatLink,
  forgetLink,
  MAX_LINKED_CHATS,
  readLink,
  recordDigestSent,
  recordSnapshot,
  setSmartAlerts,
  setWeeklyDigest,
  rotation,
  WATCHES_KEY,
  watchesForPass,
} from "./links";

const TOKEN = "abcDEF123456789012_-xy";
const OTHER = "zyxWVU987654321098_-ab";
const ADDRESS = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const NOW = new Date("2026-09-21T10:00:00.000Z");

const pending = async (store = fakeStore(), token = TOKEN) => {
  expect(await createPendingLink(store, token, { address: ADDRESS, locale: "tr", now: NOW })).toBe(true);
  return store;
};

describe("Telegram links", () => {
  it("mints a pending link that reads back with no chat and no snapshot", async () => {
    const store = await pending();
    expect(await readLink(store, TOKEN)).toEqual({
      address: ADDRESS,
      locale: "tr",
      chatId: null,
      createdAt: NOW.toISOString(),
      snapshot: null,
    });
  });

  it("tells a missing link from a store that could not answer", async () => {
    const store = fakeStore();
    expect(await readLink(store, TOKEN)).toBeNull();
    store.down = true;
    expect(await readLink(store, TOKEN)).toBeUndefined();
  });

  it("refuses to look up something that is not a token", async () => {
    const store = await pending();
    expect(await readLink(store, "../anything")).toBeNull();
    expect(store.data.size).toBe(1);
  });

  it("claims a pending link for the first chat and puts it in the watch set", async () => {
    const store = await pending();
    expect(await claimLink(store, TOKEN, 42)).toBe("claimed");
    expect((await readLink(store, TOKEN))?.chatId).toBe(42);
    expect(await store.smembers(WATCHES_KEY)).toEqual([TOKEN]);
  });

  it("lets the same chat present its token twice, and refuses a second chat", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    expect(await claimLink(store, TOKEN, 42)).toBe("claimed");
    expect(await claimLink(store, TOKEN, 43)).toBe("already-claimed");
    expect((await readLink(store, TOKEN))?.chatId).toBe(42);
  });

  it("reports an unknown token, and a store that is down", async () => {
    const store = fakeStore();
    expect(await claimLink(store, TOKEN, 42)).toBe("unknown");
    store.down = true;
    expect(await claimLink(store, TOKEN, 42)).toBe("unavailable");
  });

  it("reads only claimed links in a pass, and drops a pending or vanished token from the set", async () => {
    const store = await pending();
    await pending(store, OTHER);
    await claimLink(store, TOKEN, 42);
    await store.sadd(WATCHES_KEY, OTHER);
    await store.sadd(WATCHES_KEY, "gone_gone_gone_gone_gg");

    const pass = await watchesForPass(store, { budget: 50, after: null });
    expect(pass?.watches.map((watch) => watch.token)).toEqual([TOKEN]);
    expect(pass?.total).toBe(3);
    expect(await store.smembers(WATCHES_KEY)).toEqual([TOKEN]);
  });

  it("finds a link by its chat, and answers null for a chat that has none", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    expect((await findByChat(store, 42))?.token).toBe(TOKEN);
    expect(await findByChat(store, 7)).toBeNull();
  });

  it("records a snapshot without losing the rest of the link", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    const link = await readLink(store, TOKEN);
    if (link === null || link === undefined) throw new Error("link");

    await recordSnapshot(store, TOKEN, link, { "v3:1": true });
    expect(await readLink(store, TOKEN)).toEqual({ ...link, snapshot: { "v3:1": true } });
  });

  it("forgets a link from both the record and the set", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    await forgetLink(store, TOKEN);
    expect(await readLink(store, TOKEN)).toBeNull();
    expect(await store.smembers(WATCHES_KEY)).toEqual([]);
  });

  it("throws away a record it cannot read as a link", async () => {
    const store = fakeStore();
    store.data.set(`liquiditywise:telegram:link:${TOKEN}`, "{not json");
    expect(await readLink(store, TOKEN)).toBeNull();
    store.data.set(`liquiditywise:telegram:link:${TOKEN}`, JSON.stringify({ address: "nope" }));
    expect(await readLink(store, TOKEN)).toBeNull();
  });
});

describe("a link on a chain", () => {
  const key = `liquiditywise:telegram:link:${TOKEN}`;

  it("reads a link stored before chains existed as a mainnet link, unchanged", async () => {
    const store = fakeStore();
    store.data.set(
      key,
      JSON.stringify({ address: ADDRESS, locale: "tr", chatId: 42, createdAt: NOW.toISOString(), snapshot: { "v3:1": true } }),
    );

    const link = await readLink(store, TOKEN);

    expect(link?.chatId).toBe(42);
    expect(link?.chainId).toBeUndefined();
    expect(link?.snapshot).toEqual({ "v3:1": true });
  });

  it("writes the chain off mainnet, and nothing new for mainnet", async () => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "tr", now: NOW, chainId: 8453 });
    await createPendingLink(store, OTHER, { address: ADDRESS, locale: "tr", now: NOW, chainId: 1 });

    expect((await readLink(store, TOKEN))?.chainId).toBe(8453);
    expect(JSON.parse(store.data.get(`liquiditywise:telegram:link:${OTHER}`) ?? "{}")).not.toHaveProperty("chainId");
  });

  it("keeps the chain when the checker records what it saw", async () => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "tr", now: NOW, chainId: 42161 });
    await claimLink(store, TOKEN, 7);
    const link = await readLink(store, TOKEN);
    await recordSnapshot(store, TOKEN, link!, { "v3:9": false });

    expect((await readLink(store, TOKEN))?.chainId).toBe(42161);
  });

  it("refuses a stored link naming a chain nobody reads, rather than following it on mainnet", async () => {
    const store = fakeStore();
    store.data.set(
      key,
      JSON.stringify({ address: ADDRESS, locale: "tr", chatId: 42, createdAt: NOW.toISOString(), chainId: 324, snapshot: null }),
    );

    expect(await readLink(store, TOKEN)).toBeNull();
  });
});

describe("smart-money alerts on a link", () => {
  const claimed = async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    return store;
  };
  const link = async (store: ReturnType<typeof fakeStore>) => (await readLink(store, TOKEN)) as NonNullable<Awaited<ReturnType<typeof readLink>>>;

  it("are off on a link that never asked, and store nothing about them, whatever the checker passes", async () => {
    const store = await claimed();
    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": true }, { "0xpool": [1, 2] });

    const read = await link(store);
    expect(read.smart).toBeUndefined();
    expect(JSON.parse(store.data.get(`liquiditywise:telegram:link:${TOKEN}`) ?? "{}")).not.toHaveProperty("smart");
  });

  it("turn on with nothing told yet, keep what the checker records, and keep the record through a snapshot that passes none", async () => {
    const store = await claimed();
    expect(await setSmartAlerts(store, TOKEN, await link(store), true)).toBe(true);
    expect((await link(store)).smart).toEqual({ ranges: {} });

    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": true }, { "0xpool": [100, 200] });
    expect((await link(store)).smart).toEqual({ ranges: { "0xpool": [100, 200] } });

    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": false });
    expect((await link(store)).smart).toEqual({ ranges: { "0xpool": [100, 200] } });
    expect((await link(store)).snapshot).toEqual({ "v3:1": false });
  });

  it("turn off by deleting what was kept for them, and leave the rest of the link alone", async () => {
    const store = await claimed();
    await setSmartAlerts(store, TOKEN, await link(store), true);
    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": true }, { "0xpool": [100, 200] });
    await setSmartAlerts(store, TOKEN, await link(store), false);

    const read = await link(store);
    expect(read.smart).toBeUndefined();
    expect(read).toMatchObject({ address: ADDRESS, chatId: 42, snapshot: { "v3:1": true } });
    expect(store.data.get(`liquiditywise:telegram:link:${TOKEN}`)).not.toContain("0xpool");
  });

  it("say whether the write took", async () => {
    const store = await claimed();
    const before = await link(store);
    store.down = true;

    expect(await setSmartAlerts(store, TOKEN, before, true)).toBe(false);
  });

  it("are read as not asked for, rather than losing the link, when what is kept for them cannot be read", async () => {
    const store = await claimed();
    const raw = JSON.parse(store.data.get(`liquiditywise:telegram:link:${TOKEN}`) ?? "{}");
    store.data.set(`liquiditywise:telegram:link:${TOKEN}`, JSON.stringify({ ...raw, smart: { ranges: { "0xpool": "nope" } } }));

    expect(await readLink(store, TOKEN)).toMatchObject({ address: ADDRESS, chatId: 42 });
    expect((await link(store)).smart).toBeUndefined();
  });
});

describe("the weekly digest on a link", () => {
  const SENT = new Date("2026-10-05T08:00:00.000Z");
  const KEY = `liquiditywise:telegram:link:${TOKEN}`;
  const claimed = async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    return store;
  };
  const link = async (store: ReturnType<typeof fakeStore>) => (await readLink(store, TOKEN)) as NonNullable<Awaited<ReturnType<typeof readLink>>>;

  it("is off on a link that never asked, and nothing about it is stored", async () => {
    const store = await claimed();
    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": true });

    expect((await link(store)).weekly).toBeUndefined();
    expect(JSON.parse(store.data.get(KEY) ?? "{}")).not.toHaveProperty("weekly");
  });

  it("turns on with none sent yet, and keeps the time of the last one through the checker's snapshot", async () => {
    const store = await claimed();
    expect(await setWeeklyDigest(store, TOKEN, await link(store), true)).toBe(true);
    expect((await link(store)).weekly).toEqual({ sentAt: null });

    const sent = await recordDigestSent(store, TOKEN, await link(store), NOW);
    expect(sent.weekly).toEqual({ sentAt: NOW.toISOString() });
    expect((await link(store)).weekly).toEqual({ sentAt: NOW.toISOString() });

    await recordSnapshot(store, TOKEN, sent, { "v3:1": true });
    expect(await link(store)).toMatchObject({ weekly: { sentAt: NOW.toISOString() }, snapshot: { "v3:1": true } });
  });

  it("answers the link with the new time even when the store did not take it, for the pass to write again", async () => {
    const store = await claimed();
    await setWeeklyDigest(store, TOKEN, await link(store), true);
    const before = await link(store);
    store.down = true;

    expect((await recordDigestSent(store, TOKEN, before, NOW)).weekly).toEqual({ sentAt: NOW.toISOString() });
    store.down = false;
    expect((await link(store)).weekly).toEqual({ sentAt: null });
  });

  it("turns off by deleting the time kept for it, and leaves /smart and the rest of the link alone", async () => {
    const store = await claimed();
    await setSmartAlerts(store, TOKEN, await link(store), true);
    await setWeeklyDigest(store, TOKEN, await link(store), true);
    await recordDigestSent(store, TOKEN, await link(store), SENT);
    expect(await setWeeklyDigest(store, TOKEN, await link(store), false)).toBe(true);

    const read = await link(store);
    expect(read.weekly).toBeUndefined();
    expect(read).toMatchObject({ address: ADDRESS, chatId: 42, smart: { ranges: {} } });
    expect(JSON.parse(store.data.get(KEY) ?? "{}")).not.toHaveProperty("weekly");
    expect(store.data.get(KEY)).not.toContain(SENT.toISOString());
  });

  it("is kept through /smart turning on and off", async () => {
    const store = await claimed();
    await setWeeklyDigest(store, TOKEN, await link(store), true);
    await setSmartAlerts(store, TOKEN, await link(store), true);
    await setSmartAlerts(store, TOKEN, await link(store), false);

    expect((await link(store)).weekly).toEqual({ sentAt: null });
  });

  it("says whether the write took", async () => {
    const store = await claimed();
    const before = await link(store);
    store.down = true;

    expect(await setWeeklyDigest(store, TOKEN, before, true)).toBe(false);
  });

  it("is read as not asked for, rather than losing the link, when what is kept for it cannot be read", async () => {
    const store = await claimed();
    const raw = JSON.parse(store.data.get(KEY) ?? "{}");
    store.data.set(KEY, JSON.stringify({ ...raw, weekly: { sentAt: "last monday" } }));

    expect(await readLink(store, TOKEN)).toMatchObject({ address: ADDRESS, chatId: 42 });
    expect((await link(store)).weekly).toBeUndefined();
  });
});

/** A token for the n-th link of a test: 22 characters, as a minted one is, and sorting in the order of n. */
const tokenOf = (n: number): string => `tok${String(n).padStart(19, "0")}`;
const chatKey = (chatId: number): string => `liquiditywise:telegram:chat:${chatId}`;

/** The fake store, counting what each command was asked. */
const counting = () => {
  const inner = fakeStore();
  const [innerGet, innerSmembers] = [inner.get, inner.smembers];
  const asked = { get: 0, smembers: 0 };
  const get: KeyValueStore["get"] = (key) => {
    asked.get += 1;
    return innerGet(key);
  };
  const smembers: KeyValueStore["smembers"] = (key) => {
    asked.smembers += 1;
    return innerSmembers(key);
  };
  return Object.assign(inner, { asked, get, smembers });
};

/** A link written as it was before chats had keys: the record and the set, and nothing else. */
const oldShape = (store: ReturnType<typeof fakeStore>, token: string, chatId: number, createdAt = NOW) => {
  store.data.set(
    `liquiditywise:telegram:link:${token}`,
    JSON.stringify({ address: ADDRESS, locale: "tr", chatId, createdAt: createdAt.toISOString(), snapshot: null }),
  );
  store.sets.set(WATCHES_KEY, new Set([...(store.sets.get(WATCHES_KEY) ?? []), token]));
};

describe("one link per chat, found by the chat", () => {
  it("keeps the chat's token under the chat's id, under the prefix the backup copies", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);

    expect(store.data.get(chatKey(42))).toBe(TOKEN);
    expect(BACKUP_PREFIXES.some((prefix) => chatKey(42).startsWith(prefix))).toBe(true);
  });

  it("finds a chat's link by its key, with one read for the key and one for the link, and never walks the set", async () => {
    const store = counting();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "tr", now: NOW });
    await claimLink(store, TOKEN, 42);
    store.asked.get = 0;

    expect((await findByChat(store, 42))?.token).toBe(TOKEN);
    expect(store.asked).toEqual({ get: 2, smembers: 0 });
  });

  it("answers a chat with no link from its key alone, once the old links have keys, however many links there are", async () => {
    const store = counting();
    for (let n = 0; n < 30; n += 1) oldShape(store, tokenOf(n), 1_000 + n);
    expect(await buildChatIndex(store)).toBe(true);
    store.asked.get = 0;
    store.asked.smembers = 0;

    expect(await findByChat(store, 7)).toBeNull();
    expect(store.asked).toEqual({ get: 2, smembers: 0 });
  });

  it("gives up a chat's first link when it claims a second, so a chat follows one address", async () => {
    const store = await pending();
    await pending(store, OTHER);
    await claimLink(store, TOKEN, 42);
    expect(await claimLink(store, OTHER, 42)).toBe("claimed");

    expect(await readLink(store, TOKEN)).toBeNull();
    expect(await store.smembers(WATCHES_KEY)).toEqual([OTHER]);
    expect(store.data.get(chatKey(42))).toBe(OTHER);
    expect((await findByChat(store, 42))?.token).toBe(OTHER);
  });

  it("holds a chat to one link in the set however many tokens it claims", async () => {
    const store = fakeStore();
    for (let n = 0; n < 20; n += 1) {
      await createPendingLink(store, tokenOf(n), { address: ADDRESS, locale: "tr", now: NOW });
      expect(await claimLink(store, tokenOf(n), 42)).toBe("claimed");
    }
    expect(await store.smembers(WATCHES_KEY)).toEqual([tokenOf(19)]);
  });

  it("turns a new chat away past the ceiling over every chat, and never a chat that only swaps its link", async () => {
    const store = await pending();
    await pending(store, OTHER);
    await claimLink(store, TOKEN, 42);
    for (let n = 1; n < MAX_LINKED_CHATS; n += 1) await store.sadd(WATCHES_KEY, tokenOf(n));

    const newcomer = "newNEW123456789012_-zz";
    await createPendingLink(store, newcomer, { address: ADDRESS, locale: "tr", now: NOW });
    expect(await claimLink(store, newcomer, 7)).toBe("crowded");
    expect((await readLink(store, newcomer))?.chatId).toBeNull();
    expect(store.data.has(chatKey(7))).toBe(false);

    expect(await claimLink(store, OTHER, 42)).toBe("claimed");
  });

  it("deletes the chat's key with the link, from either side, and a key naming another link is left alone", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    await forgetLink(store, TOKEN);
    expect(store.data.has(chatKey(42))).toBe(false);

    await pending(store, OTHER);
    await claimLink(store, OTHER, 42);
    oldShape(store, TOKEN, 42);
    await forgetLink(store, TOKEN);
    expect(store.data.get(chatKey(42))).toBe(OTHER);
  });

  it("leaves nothing of the chat on /stop: the link, its place in the set, and the key", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    await forgetChatLink(store, 42, TOKEN);

    expect([...store.data.keys()].filter((key) => key !== CHAT_INDEX_BUILT_KEY)).toEqual([]);
    expect(await store.smembers(WATCHES_KEY)).toEqual([]);
  });

  it("deletes the chat's key on /stop even when the link it named cannot be read back", async () => {
    const inner = await pending();
    await claimLink(inner, TOKEN, 42);
    /* The forget's own read of the link does not answer: only the chat's key says whose it was. */
    const store: KeyValueStore = { ...inner, get: async (key) => (key.includes(":link:") ? undefined : inner.get(key)) };
    await forgetChatLink(store, 42, TOKEN);

    expect(inner.data.has(chatKey(42))).toBe(false);
    expect(inner.data.has(`liquiditywise:telegram:link:${TOKEN}`)).toBe(false);
    expect(await inner.smembers(WATCHES_KEY)).toEqual([]);
  });

  it("deletes a key that names something not the chat's link, and answers no link", async () => {
    const store = fakeStore();
    await store.set(CHAT_INDEX_BUILT_KEY, "1");
    await store.set(chatKey(42), TOKEN);

    expect(await findByChat(store, 42)).toBeNull();
    expect(store.data.has(chatKey(42))).toBe(false);
  });

  it("says the store is down rather than that there is no link", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    store.down = true;
    expect(await findByChat(store, 42)).toBeUndefined();
    expect(await claimLink(store, TOKEN, 42)).toBe("unavailable");
  });
});

describe("a claim cut off halfway", () => {
  it("is answered as no link, and the pass gives the chat its old link back", async () => {
    const store = await pending();
    await pending(store, OTHER);
    await claimLink(store, TOKEN, 42);
    await store.set(CHAT_INDEX_BUILT_KEY, "1");
    /* The first step of claiming OTHER, and nothing after it. */
    await store.set(chatKey(42), OTHER);

    expect(await findByChat(store, 42)).toBeNull();
    await watchesForPass(store, { budget: 50, after: null });
    expect((await findByChat(store, 42))?.token).toBe(TOKEN);
  });

  it("is finished by presenting the token again, and nothing is left that the set cannot find", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    /* Claimed, keyed, and the set never told. */
    await store.srem(WATCHES_KEY, TOKEN);

    expect(await claimLink(store, TOKEN, 42)).toBe("claimed");
    expect(await store.smembers(WATCHES_KEY)).toEqual([TOKEN]);
  });
});

describe("links made before chats had keys", () => {
  it("are still found by their chat before the first pass, and given their key when found", async () => {
    const store = fakeStore();
    oldShape(store, TOKEN, 42);

    expect((await findByChat(store, 42))?.token).toBe(TOKEN);
    expect(store.data.get(chatKey(42))).toBe(TOKEN);
  });

  it("are stopped by /stop before the first pass, leaving nothing behind", async () => {
    const store = fakeStore();
    oldShape(store, TOKEN, 42);
    const found = await findByChat(store, 42);
    if (found === null || found === undefined) throw new Error("found");
    await forgetChatLink(store, 42, found.token);

    expect(store.data.size).toBe(0);
    expect(await store.smembers(WATCHES_KEY)).toEqual([]);
  });

  it("are all given their key by the first pass, which leaves its mark, and are checked as they always were", async () => {
    const store = fakeStore();
    for (let n = 0; n < 5; n += 1) oldShape(store, tokenOf(n), 100 + n);

    expect(await buildChatIndex(store)).toBe(true);
    for (let n = 0; n < 5; n += 1) expect(store.data.get(chatKey(100 + n))).toBe(tokenOf(n));
    expect(store.data.get(CHAT_INDEX_BUILT_KEY)).toBe("1");
    expect((await watchesForPass(store, { budget: 50, after: null }))?.watches).toHaveLength(5);
  });

  it("are not marked as keyed while a link could not be read, so the next pass walks them again", async () => {
    const inner = fakeStore();
    oldShape(inner, TOKEN, 42);
    const store: KeyValueStore = { ...inner, get: async (key) => (key.includes(":link:") ? undefined : inner.get(key)) };

    expect(await buildChatIndex(store)).toBe(false);
    expect(inner.data.has(CHAT_INDEX_BUILT_KEY)).toBe(false);
  });

  it("leave a chat that had claimed several with the newest, as claiming them today would", async () => {
    const store = fakeStore();
    oldShape(store, tokenOf(1), 42, new Date("2026-09-01T00:00:00.000Z"));
    oldShape(store, tokenOf(2), 42, new Date("2026-09-03T00:00:00.000Z"));
    oldShape(store, tokenOf(3), 42, new Date("2026-09-02T00:00:00.000Z"));

    await buildChatIndex(store);

    expect(await store.smembers(WATCHES_KEY)).toEqual([tokenOf(2)]);
    expect(store.data.get(chatKey(42))).toBe(tokenOf(2));
    expect(await readLink(store, tokenOf(1))).toBeNull();
    expect(await readLink(store, tokenOf(3))).toBeNull();
  });

  it("settle two links of one chat the same way when a pass meets them, the older not read", async () => {
    const store = fakeStore();
    await store.set(CHAT_INDEX_BUILT_KEY, "1");
    oldShape(store, tokenOf(1), 42, new Date("2026-09-01T00:00:00.000Z"));
    oldShape(store, tokenOf(2), 42, new Date("2026-09-03T00:00:00.000Z"));

    const pass = await watchesForPass(store, { budget: 50, after: null });
    expect(pass?.watches.map((watch) => watch.token)).toEqual([tokenOf(2)]);
    expect(await store.smembers(WATCHES_KEY)).toEqual([tokenOf(2)]);
  });
});

describe("the links one pass reads", () => {
  it("takes the budget's worth after the last, in a fixed order, coming round again", () => {
    const members = ["e", "a", "d", "c", "b"];
    expect(rotation(members, 2, null)).toEqual(["a", "b"]);
    expect(rotation(members, 2, "b")).toEqual(["c", "d"]);
    expect(rotation(members, 2, "d")).toEqual(["e", "a"]);
    expect(rotation(members, 9, "c")).toEqual(["d", "e", "a", "b", "c"]);
    expect(rotation([], 2, "c")).toEqual([]);
  });

  it("starts where it left off even when the last one it took has gone", () => {
    expect(rotation(["a", "c", "e"], 1, "b")).toEqual(["c"]);
    expect(rotation(["a", "c", "e"], 1, "f")).toEqual(["a"]);
  });

  it("starts a pass with no last one at the place it is given", () => {
    expect(rotation(["a", "b", "c"], 2, null, 2)).toEqual(["c", "a"]);
    expect(rotation(["a", "b", "c"], 2, null, 7)).toEqual(["b", "c"]);
  });

  it("reads no more links than its budget, and every link within as many passes as there are budgets of them", async () => {
    const store = fakeStore();
    await store.set(CHAT_INDEX_BUILT_KEY, "1");
    for (let n = 0; n < 7; n += 1) oldShape(store, tokenOf(n), 100 + n);

    const seen: string[] = [];
    let after: string | null = null;
    for (let run = 0; run < 3; run += 1) {
      const pass = await watchesForPass(store, { budget: 3, after });
      expect(pass?.watches.length).toBeLessThanOrEqual(3);
      expect(pass?.total).toBe(7);
      seen.push(...(pass?.watches ?? []).map((watch) => watch.token));
      after = pass?.last ?? null;
    }

    expect(new Set(seen).size).toBe(7);
    expect(seen.slice(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6].map(tokenOf));
  });
});
