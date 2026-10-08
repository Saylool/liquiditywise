import { describe, expect, it } from "vitest";

import { formatPrice } from "../format/displayFormats";
import type { AddressPositionsResult } from "../advisor/addressPositions";
import type { Position } from "../../schemas";
import { getDictionary } from "../i18n/dictionaries";
import type { BotClient } from "./botApi";
import { checkWatches, LINKS_PER_PASS, type PassCursor, POOLS_PER_PASS } from "./checkWatches";
import { fakeStore } from "./fakeStore";
import type { SmartPair } from "../analytics/smartLiquidity";
import { CHAT_INDEX_BUILT_KEY, claimLink, createPendingLink, findByChat, readLink, setSmartAlerts, setWeeklyDigest } from "./links";
import { poolRangeMovedText } from "./messages";
import type { PoolWatchTarget } from "./poolWatchCommand";
import type { PoolRangeReading } from "./poolRangeShift";
import { addPoolWatch, POOL_WATCHERS_KEY, readPoolWatches } from "./poolWatches";
import type { SmartSnapshot, SnapshotPair } from "../analytics/smartHistory";
import type { ChainId } from "../chains/chains";
import type { DataResult, PoolSearchResults } from "../../schemas";
import type { PairPoolReaders } from "../advisor/readPairPools";
import type { V4PoolDays } from "../uniswap/ethereumV4PoolDays";
import { priceAtTick } from "../uniswap/v3TickMath";

/** No measurement kept: the position alerts under test are all these passes have to say. */
const none = () => new Map<string, never>();

/* No series kept, on a Tuesday: no digest is due or could be sent, whichever link asked. No pool can be read either: no chat here watches one. */
const noDigest = { readSmartSeries: async () => null, now: () => new Date("2026-10-06T09:00:00.000Z"), readPoolRange: async () => null };

const TOKEN = "abcDEF123456789012_-xy";
const ADDRESS = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";

const position = (tokenId: string, inRange: boolean | null): Position =>
  ({
    tokenId,
    pool: {
      protocolVersion: "v3",
      id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
      token0: { symbol: "USDC", decimals: 6 },
      token1: { symbol: "WETH", decimals: 18 },
    },
    tickLower: 190000,
    tickUpper: 200000,
    lowerPrice: 0.0003,
    upperPrice: 0.0005,
    inRange,
  }) as unknown as Position;

const answer = (positions: readonly Position[]): AddressPositionsResult =>
  ({ status: "success", data: { positions } }) as unknown as AddressPositionsResult;

const bot = () => {
  const sent: { chatId: number; text: string }[] = [];
  const client: BotClient = {
    sendMessage: async (chatId, text) => {
      sent.push({ chatId, text });
      return true;
    },
  };
  return { client, sent };
};

const linked = async () => {
  const store = fakeStore();
  await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "tr", now: new Date() });
  await claimLink(store, TOKEN, 42);
  return store;
};

describe("checkWatches", () => {
  it("records what it saw on the first pass and sends nothing", async () => {
    const store = await linked();
    const { client, sent } = bot();
    const asked: string[] = [];

    const summary = await checkWatches({
      store,
      bot: client,
      readPositions: async (address) => {
        asked.push(address);
        return answer([position("1", true)]);
      },
      dictionary: getDictionary, ...noDigest, readSmartPairs: none,
    });

    expect(asked).toEqual([ADDRESS]);
    expect(sent).toEqual([]);
    expect(summary).toEqual({ watches: 1, checked: 1, unreadable: 0, alerts: 0, sent: 0, digests: 0, poolWatches: 0, poolsUnreadable: 0, poolAlerts: 0, storeUnavailable: false });
    expect((await readLink(store, TOKEN))?.snapshot).toEqual({ "v3:1": true });
  });

  it("sends one message per change, in the link's language, and moves the snapshot on", async () => {
    const store = await linked();
    const { client, sent } = bot();
    const read = { positions: [position("1", true)] };
    const check = () =>
      checkWatches({ store, bot: client, readPositions: async () => answer(read.positions), dictionary: getDictionary, ...noDigest, readSmartPairs: none });

    await check();
    read.positions = [position("1", false)];
    const summary = await check();

    expect(summary.alerts).toBe(1);
    expect(summary.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe(42);
    expect(sent[0]?.text).toContain("USDC/WETH");
    expect(sent[0]?.text).toContain("Uniswap v3");
    expect(sent[0]?.text).toContain(getDictionary("tr").telegram.footer);
    expect(sent[0]?.text.startsWith("⚠️")).toBe(true);
    expect((await readLink(store, TOKEN))?.snapshot).toEqual({ "v3:1": false });

    /* Same reading again: nothing new to say. */
    await check();
    expect(sent).toHaveLength(1);
  });

  it("leaves the snapshot alone when an address could not be read", async () => {
    const store = await linked();
    const { client, sent } = bot();
    await checkWatches({ store, bot: client, readPositions: async () => answer([position("1", true)]), dictionary: getDictionary, ...noDigest, readSmartPairs: none });

    const summary = await checkWatches({
      store,
      bot: client,
      readPositions: async () => ({ status: "unavailable", notice: "positions-unreadable" }),
      dictionary: getDictionary, ...noDigest, readSmartPairs: none,
    });

    expect(summary).toMatchObject({ checked: 0, unreadable: 1, alerts: 0 });
    expect(sent).toEqual([]);
    expect((await readLink(store, TOKEN))?.snapshot).toEqual({ "v3:1": true });
  });

  it("counts a message that could not be sent as an alert but not as sent", async () => {
    const store = await linked();
    const read = { positions: [position("1", true)] };
    const failing: BotClient = { sendMessage: async () => false };
    const check = () =>
      checkWatches({ store, bot: failing, readPositions: async () => answer(read.positions), dictionary: getDictionary, ...noDigest, readSmartPairs: none });

    await check();
    read.positions = [];
    expect(await check()).toMatchObject({ alerts: 1, sent: 0 });
  });

  it("reports the store being unavailable and checks nothing", async () => {
    const store = await linked();
    store.down = true;
    let asked = 0;
    const summary = await checkWatches({
      store,
      bot: bot().client,
      readPositions: async () => {
        asked += 1;
        return answer([]);
      },
      dictionary: getDictionary, ...noDigest, readSmartPairs: none,
    });
    expect(asked).toBe(0);
    expect(summary.storeUnavailable).toBe(true);
  });
});

describe("checkWatches, near an edge", () => {
  const at = (tick: number): Position =>
    ({
      tokenId: "7",
      pool: {
        protocolVersion: "v3",
        id: ADDRESS,
        token0: { symbol: "USDC", decimals: 6 },
        token1: { symbol: "WETH", decimals: 18 },
      },
      tickLower: 0,
      tickUpper: 5108,
      lowerPrice: 0.0003,
      upperPrice: 0.0005,
      currentTick: tick,
      inRange: tick >= 0 && tick < 5108,
    }) as unknown as Position;

  it("warns once when a position comes close, keeps that it did, and stays quiet the next pass", async () => {
    const store = await linked();
    const { client, sent } = bot();
    const pass = (tick: number) =>
      checkWatches({ store, bot: client, readPositions: async () => answer([at(tick)]), dictionary: getDictionary, ...noDigest, readSmartPairs: none });

    await pass(2500);
    await pass(5000);
    // Back a little, still within a fifth of the width of the edge, then close again: one warning, not two.
    await pass(4200);
    await pass(5000);

    expect(sent.map(({ text }) => [...text][0])).toEqual(["⏳"]);
    expect((await readLink(store, TOKEN))?.snapshot).toEqual({ "v3:7": "near" });
  });
});

describe("checking a link on a chain", () => {
  const askedOn = async (chainId?: number) => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, {
      address: ADDRESS,
      locale: "tr",
      now: new Date(),
      ...(chainId === undefined ? {} : { chainId: chainId as 8453 }),
    });
    await claimLink(store, TOKEN, 42);
    const asked: [string, number][] = [];
    await checkWatches({
      store,
      bot: bot().client,
      readPositions: async (address, chain) => {
        asked.push([address, chain]);
        return answer([position("1", true)]);
      },
      dictionary: getDictionary, ...noDigest, readSmartPairs: none,
    });
    return asked;
  };

  it("reads the address on the link's own chain", async () => {
    expect(await askedOn(8453)).toEqual([[ADDRESS, 8453]]);
  });

  it("reads a link with no chain in it on mainnet", async () => {
    expect(await askedOn()).toEqual([[ADDRESS, 1]]);
  });
});

describe("a closed position on a chain", () => {
  it("names the link's chain in the message, since nothing is left of the pool to ask", async () => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "en", now: new Date(), chainId: 8453 });
    await claimLink(store, TOKEN, 42);
    const { client, sent } = bot();
    const check = (positions: readonly Position[]) =>
      checkWatches({ store, bot: client, readPositions: async () => answer(positions), dictionary: getDictionary, ...noDigest, readSmartPairs: none });

    await check([position("5", true)]);
    await check([]);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("Uniswap v3 · Base");
  });
});

describe("checkWatches and the smart-money alert", () => {
  const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
  const pairAt = (lower: number, upper: number, positions = 6): SmartPair =>
    ({
      pool: { protocolVersion: "v3", chainId: 1, id: POOL, feePpm: 500, token0: { symbol: "USDC" }, token1: { symbol: "WETH" } },
      positions,
      medianLowerPrice: lower,
      medianUpperPrice: upper,
      currentPrice: (lower + upper) / 2,
    }) as unknown as SmartPair;

  const asked = async (on: boolean) => {
    const store = await linked();
    if (on) await setSmartAlerts(store, TOKEN, (await readLink(store, TOKEN)) as never, true);
    const { client, sent } = bot();
    const kept = { pairs: new Map<string, SmartPair>([[POOL, pairAt(0.0003, 0.0005)]]) };
    const check = () =>
      checkWatches({
        store,
        bot: client,
        readPositions: async () => answer([position("1", true)]),
        dictionary: getDictionary, ...noDigest,
        readSmartPairs: () => kept.pairs,
      });
    return { store, sent, kept, check };
  };

  it("makes a baseline on the first pass and says nothing, then tells a shift once, in the link's language", async () => {
    const { store, sent, kept, check } = await asked(true);

    await check();
    expect(sent).toEqual([]);
    expect((await readLink(store, TOKEN))?.smart?.ranges).toEqual({ [POOL]: [0.0003, 0.0005] });

    kept.pairs = new Map([[POOL, pairAt(0.0005, 0.0009)]]);
    const summary = await check();
    expect(summary).toMatchObject({ alerts: 1, sent: 1 });
    expect(sent[0]?.text.startsWith("🔀")).toBe(true);
    expect(sent[0]?.text).toContain("USDC/WETH");
    expect(sent[0]?.text).toContain(getDictionary("tr").telegram.footer);
    expect((await readLink(store, TOKEN))?.smart?.ranges).toEqual({ [POOL]: [0.0005, 0.0009] });

    await check();
    expect(sent).toHaveLength(1);
  });

  it("says nothing of any of it to a chat that did not ask, and keeps nothing for it", async () => {
    const { store, sent, kept, check } = await asked(false);

    await check();
    kept.pairs = new Map([[POOL, pairAt(0.0005, 0.0009)]]);
    await check();

    expect(sent).toEqual([]);
    expect((await readLink(store, TOKEN))?.smart).toBeUndefined();
  });

  it("sends the position alert and the smart alert both when both are due, and counts both", async () => {
    const store = await linked();
    await setSmartAlerts(store, TOKEN, (await readLink(store, TOKEN)) as never, true);
    const { client, sent } = bot();
    const state = { positions: [position("1", true)], pairs: new Map([[POOL, pairAt(0.0003, 0.0005)]]) };
    const check = () =>
      checkWatches({
        store,
        bot: client,
        readPositions: async () => answer(state.positions),
        dictionary: getDictionary, ...noDigest,
        readSmartPairs: () => state.pairs,
      });

    await check();
    state.positions = [position("1", false)];
    state.pairs = new Map([[POOL, pairAt(0.0005, 0.0009)]]);
    const summary = await check();

    expect(summary).toMatchObject({ alerts: 2, sent: 2 });
    expect(sent.map(({ text }) => text.slice(0, 2))).toEqual(["⚠️", "🔀"]);
  });

  it("asks for the measurement of the chain the link is on", async () => {
    const store = await linked();
    await setSmartAlerts(store, TOKEN, (await readLink(store, TOKEN)) as never, true);
    const chains: number[] = [];
    await checkWatches({
      store,
      bot: bot().client,
      readPositions: async () => answer([position("1", true)]),
      dictionary: getDictionary, ...noDigest,
      readSmartPairs: (chainId) => {
        chains.push(chainId);
        return new Map();
      },
    });

    expect(chains).toEqual([1]);
  });

  it("asks for the measurement of a link on another chain, not mainnet's", async () => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "tr", now: new Date(), chainId: 137 });
    await claimLink(store, TOKEN, 42);
    await setSmartAlerts(store, TOKEN, (await readLink(store, TOKEN)) as never, true);
    const chains: number[] = [];
    await checkWatches({
      store,
      bot: bot().client,
      readPositions: async () => answer([position("1", true)]),
      dictionary: getDictionary, ...noDigest,
      readSmartPairs: (chainId) => {
        chains.push(chainId);
        return new Map();
      },
    });

    expect(chains).toEqual([137]);
  });

  it("keeps the baseline when an address could not be read, so a shift is still told next time", async () => {
    const { store, kept, check } = await asked(true);
    await check();
    kept.pairs = new Map([[POOL, pairAt(0.0005, 0.0009)]]);
    await checkWatches({
      store,
      bot: bot().client,
      readPositions: async () => ({ status: "unavailable", notice: "positions-unreadable" }),
      dictionary: getDictionary, ...noDigest,
      readSmartPairs: () => kept.pairs,
    });

    expect((await readLink(store, TOKEN))?.smart?.ranges).toEqual({ [POOL]: [0.0003, 0.0005] });
  });
});

describe("checkWatches and the Monday digest", () => {
  const MONDAY_EIGHT = "2026-10-05T08:00:00.000Z";
  const kept = (pool: string, valueUsd: number, lower: number, upper: number): SnapshotPair => ({
    pool,
    pair: "USDC / WETH",
    feePpm: 500,
    positions: 6,
    valueUsd,
    lowerPrice: lower,
    upperPrice: upper,
    currentPrice: (lower + upper) / 2,
    yearlyYield: 0.2,
  });
  const measured = (at: string, pairs: readonly SnapshotPair[]): SmartSnapshot => ({
    at,
    measured: 100,
    smart: 20,
    medianYearlyYield: 0.1,
    smartFrom: 0.2,
    pairs: [...pairs],
  });
  /* A week in which 0xb gained a share and 0xa lost one, and 0xa's range moved up. */
  const WEEK: readonly SmartSnapshot[] = [
    measured("2026-09-28T09:00:00.000Z", [kept("0xa", 60, 0.0003, 0.0005), kept("0xb", 40, 1, 2)]),
    measured("2026-10-05T06:00:00.000Z", [kept("0xa", 30, 0.0004, 0.0006), kept("0xb", 70, 1, 2)]),
  ];

  const subscribed = async ({ chainId, locale = "tr" }: { chainId?: ChainId; locale?: "tr" | "en" } = {}) => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale, now: new Date(), ...(chainId === undefined ? {} : { chainId }) });
    await claimLink(store, TOKEN, 42);
    await setWeeklyDigest(store, TOKEN, (await readLink(store, TOKEN)) as never, true);
    return store;
  };

  const passes = (store: ReturnType<typeof fakeStore>, state: { series: readonly SmartSnapshot[] | null; time: string; delivers?: boolean; readable?: boolean }) => {
    const sent: { chatId: number; text: string }[] = [];
    const asked: number[] = [];
    const pass = () =>
      checkWatches({
        store,
        bot: {
          sendMessage: async (chatId, text) => {
            if (state.delivers === false) return false;
            sent.push({ chatId, text });
            return true;
          },
        },
        readPositions: async () =>
          state.readable === false ? { status: "unavailable", notice: "positions-unreadable" } : answer([position("1", true)]),
        dictionary: getDictionary,
        readSmartPairs: none,
        readSmartSeries: async (chainId) => {
          asked.push(chainId);
          return state.series;
        },
        now: () => new Date(state.time),
        readPoolRange: async () => null,
      });
    return { sent, asked, pass };
  };

  it("sends the digest at eight on Monday, in the link's language, records it, and does not send it twice", async () => {
    const store = await subscribed();
    const state = { series: WEEK, time: "2026-10-05T07:55:00.000Z" };
    const { sent, pass } = passes(store, state);

    expect(await pass()).toMatchObject({ digests: 0 });
    expect(sent).toEqual([]);

    state.time = "2026-10-05T08:00:00.000Z";
    expect(await pass()).toMatchObject({ digests: 1, alerts: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe(42);
    expect(sent[0]?.text.startsWith(getDictionary("tr").telegram.weeklyHeading("Ethereum", "7"))).toBe(true);
    expect(sent[0]?.text).toContain(getDictionary("tr").telegram.weeklyGaining);
    expect(sent[0]?.text).toContain("https://liquiditywise.com/tr/smart-money?chain=ethereum");
    expect((await readLink(store, TOKEN))?.weekly).toEqual({ sentAt: MONDAY_EIGHT });

    state.time = "2026-10-05T08:05:00.000Z";
    expect(await pass()).toMatchObject({ digests: 0 });
    state.time = "2026-10-05T23:55:00.000Z";
    await pass();
    expect(sent).toHaveLength(1);
  });

  it("does not send it again after a restart, since the time is kept in the store and not the process", async () => {
    const store = await subscribed();
    await passes(store, { series: WEEK, time: "2026-10-05T08:00:00.000Z" }).pass();

    const afterRestart = passes(store, { series: WEEK, time: "2026-10-05T09:00:00.000Z" });
    await afterRestart.pass();

    expect(afterRestart.sent).toEqual([]);
    expect(afterRestart.asked).toEqual([]);
  });

  it("sends the next one the next Monday, and none on the days between", async () => {
    const store = await subscribed();
    const state = { series: WEEK, time: "2026-10-05T08:00:00.000Z" };
    const { sent, pass } = passes(store, state);

    await pass();
    for (const time of ["2026-10-06T08:00:00.000Z", "2026-10-09T12:00:00.000Z", "2026-10-12T07:59:00.000Z"]) {
      state.time = time;
      await pass();
    }
    expect(sent).toHaveLength(1);

    state.time = "2026-10-12T08:00:00.000Z";
    await pass();
    expect(sent).toHaveLength(2);
    expect((await readLink(store, TOKEN))?.weekly).toEqual({ sentAt: "2026-10-12T08:00:00.000Z" });
  });

  it("sends nothing, and records nothing, until a day of measurements is kept — and sends once there is, that Monday", async () => {
    const store = await subscribed();
    const state: { series: readonly SmartSnapshot[] | null; time: string } = {
      series: [measured("2026-10-05T01:00:00.000Z", WEEK[0]!.pairs), measured("2026-10-05T06:00:00.000Z", WEEK[1]!.pairs)],
      time: "2026-10-05T08:00:00.000Z",
    };
    const { sent, pass } = passes(store, state);

    expect(await pass()).toMatchObject({ digests: 0 });
    expect(sent).toEqual([]);
    expect((await readLink(store, TOKEN))?.weekly).toEqual({ sentAt: null });

    state.series = [];
    await pass();
    state.series = null;
    await pass();
    expect(sent).toEqual([]);
    expect((await readLink(store, TOKEN))?.weekly).toEqual({ sentAt: null });

    state.series = WEEK;
    state.time = "2026-10-05T14:00:00.000Z";
    await pass();
    expect(sent).toHaveLength(1);
  });

  it("does not record a digest Telegram did not take, and sends it on the next pass", async () => {
    const store = await subscribed();
    const state = { series: WEEK, time: "2026-10-05T08:00:00.000Z", delivers: false };
    const { sent, pass } = passes(store, state);

    expect(await pass()).toMatchObject({ digests: 0 });
    expect((await readLink(store, TOKEN))?.weekly).toEqual({ sentAt: null });

    state.delivers = true;
    state.time = "2026-10-05T08:05:00.000Z";
    expect(await pass()).toMatchObject({ digests: 1 });
    expect(sent).toHaveLength(1);
    expect((await readLink(store, TOKEN))?.weekly).toEqual({ sentAt: "2026-10-05T08:05:00.000Z" });
  });

  it("sends it even when the address could not be read, since it is about the chain and not the address", async () => {
    const store = await subscribed();
    const { sent, pass } = passes(store, { series: WEEK, time: MONDAY_EIGHT, readable: false });

    expect(await pass()).toMatchObject({ digests: 1, unreadable: 1 });
    expect(sent).toHaveLength(1);
    expect((await readLink(store, TOKEN))?.weekly).toEqual({ sentAt: MONDAY_EIGHT });
  });

  it("keeps the time through the snapshot the same pass writes, and keeps the snapshot", async () => {
    const store = await subscribed();
    await passes(store, { series: WEEK, time: MONDAY_EIGHT }).pass();

    expect(await readLink(store, TOKEN)).toMatchObject({ weekly: { sentAt: MONDAY_EIGHT }, snapshot: { "v3:1": true } });
  });

  it("sends nothing to a chat that did not ask, and does not read the series for it", async () => {
    const store = await linked();
    const { sent, asked, pass } = passes(store, { series: WEEK, time: MONDAY_EIGHT });

    expect(await pass()).toMatchObject({ digests: 0 });
    expect(sent).toEqual([]);
    expect(asked).toEqual([]);
    expect((await readLink(store, TOKEN))?.weekly).toBeUndefined();
  });

  it("reads the series of the link's chain, and Ethereum's for a chain where none is measured", async () => {
    const onBase = passes(await subscribed({ chainId: 8453, locale: "en" }), { series: WEEK, time: MONDAY_EIGHT });
    await onBase.pass();
    expect(onBase.asked).toEqual([8453]);
    expect(onBase.sent[0]?.text).toContain("https://liquiditywise.com/en/smart-money?chain=base");
    expect(onBase.sent[0]?.text).toContain("· Base");

    const onUnichain = passes(await subscribed({ chainId: 130, locale: "en" }), { series: WEEK, time: MONDAY_EIGHT });
    await onUnichain.pass();
    expect(onUnichain.asked).toEqual([1]);
    expect(onUnichain.sent[0]?.text).toContain("?chain=ethereum");
  });

  it("reads each chain's series once a pass, however many chats are due on it", async () => {
    const store = await subscribed();
    const OTHER = "zyxWVU987654321098_-ab";
    await createPendingLink(store, OTHER, { address: ADDRESS, locale: "en", now: new Date() });
    await claimLink(store, OTHER, 43);
    await setWeeklyDigest(store, OTHER, (await readLink(store, OTHER)) as never, true);
    const { sent, asked, pass } = passes(store, { series: WEEK, time: MONDAY_EIGHT });

    expect(await pass()).toMatchObject({ digests: 2 });
    expect(asked).toEqual([1]);
    expect(sent.map(({ chatId }) => chatId).sort()).toEqual([42, 43]);
  });
});

describe("checkWatches, when a position leaves its range", () => {
  const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
  const price = (tick: number) => priceAtTick({ tick, token0Decimals: 6, token1Decimals: 18 }) as number;

  /* Mainnet #998651's shape: USDC/WETH at 0.05%, ticks 190190 to 200570, the chain's liquidity. */
  const at = (tokenId: string, tick: number): Position => ({
    tokenId,
    pool: {
      protocolVersion: "v3",
      chainId: 1,
      id: POOL,
      token0: { chainId: 1, address: USDC, symbol: "USDC", decimals: 6 },
      token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
      feePpm: 500,
    },
    tickLower: 190_190,
    tickUpper: 200_570,
    lowerPrice: price(190_190),
    upperPrice: price(200_570),
    liquidity: "2204989653163776",
    uncollected: null,
    currentTick: tick,
    inRange: tick >= 190_190 && tick < 200_570,
  });

  const FETCHED_AT = "2026-09-24T12:00:00.000Z";
  const card = {
    id: POOL,
    feeTier: "500",
    totalValueLockedUSD: "1",
    poolDayData: [],
    token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.00025" },
    token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
  };

  /** The pair page's reads, counted: the pool holds $1,000,000 and charged $650 over six and a half days, 3.65% a year. */
  const readers = (overrides: Partial<PairPoolReaders> = {}) => {
    const asked: string[] = [];
    const reading: PairPoolReaders = {
      searchV3: async () => {
        asked.push("search");
        return {
          status: "success",
          data: {
            terms: ["USDC", "WETH"],
            fetchedAt: FETCHED_AT,
            source: "uniswap-v3-subgraph",
            matches: [
              {
                pool: at("0", 0).pool,
                reserves: { token0: String(500_000n * 10n ** 6n), token1: String(125n * 10n ** 18n) },
                ethPrice: { token0: 1 / 4000, token1: 1 },
                exactSymbolMatches: 2,
              },
            ],
          },
        } as unknown as DataResult<PoolSearchResults>;
      },
      searchV4: async () => {
        asked.push("search v4");
        return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
      },
      daysV3: async () => {
        asked.push("days");
        const days: V4PoolDays = {
          fetchedAt: FETCHED_AT,
          payload: { data: { poolDayDatas: [{ date: 1, volumeUSD: "1300000", feesUSD: "650", pool: card }], _meta: { hasIndexingErrors: false } } },
        };
        return { status: "success", data: days };
      },
      daysV4: async () => {
        asked.push("days v4");
        return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
      },
      nativeUsd: async () => {
        asked.push("price");
        return { status: "success", data: 4_000 };
      },
      ...overrides,
    };
    return { reading, asked };
  };

  const watching = async (locale: "en" | "tr" = "en") => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale, now: new Date() });
    await claimLink(store, TOKEN, 42);
    const { client, sent } = bot();
    const state = { positions: [at("1", 195_000)] };
    const pass = (pairReaders?: PairPoolReaders) =>
      checkWatches({
        store,
        bot: client,
        readPositions: async () => answer(state.positions),
        dictionary: getDictionary,
        ...noDigest,
        readSmartPairs: none,
        ...(pairReaders === undefined ? {} : { pairReaders }),
      });
    return { state, sent, pass };
  };

  const en = getDictionary("en").telegram;

  it("adds what the range is missing and what coming back would cost, before the footer", async () => {
    const { state, sent, pass } = await watching();
    const { reading } = readers();
    await pass(reading);
    state.positions = [at("1", 180_000)];
    await pass(reading);

    const text = sent[0]?.text ?? "";
    const parts = text.split("\n\n");
    expect(parts).toHaveLength(4);
    expect(parts[0]?.startsWith("⚠️ USDC/WETH (Uniswap v3) has left its range:")).toBe(true);
    expect(parts[1]).toBe(en.leftFeeYield("3.65%"));
    expect(parts[2]).toMatch(/^Re-centring it on the current price at the same width, as .+ USDC\/WETH, would mean swapping about [\d,.]+ USDC; the pool's 0\.05% fee on that is about [\d,.]+ USDC\. Price impact and gas are not counted\.$/);
    expect(parts[3]).toBe(en.footer);
  });

  it("reads the pair page's figures once in a pass, however many positions in the pool leave", async () => {
    const { state, sent, pass } = await watching();
    const { reading, asked } = readers();
    state.positions = [at("1", 195_000), at("2", 196_000)];
    await pass(reading);
    state.positions = [at("1", 180_000), at("2", 210_000)];
    await pass(reading);

    expect(sent).toHaveLength(2);
    expect(sent.every(({ text }) => text.includes(en.leftFeeYield("3.65%")))).toBe(true);
    expect(asked.sort()).toEqual(["days", "price", "search"]);
  });

  it("reads nothing and adds nothing for a position coming close to an edge, or coming back", async () => {
    const { state, sent, pass } = await watching();
    const { reading, asked } = readers();
    state.positions = [at("1", 195_000)];
    await pass(reading);
    state.positions = [at("1", 200_500)];
    await pass(reading);
    expect(asked).toEqual([]);
    state.positions = [at("1", 210_000)];
    await pass(reading);
    expect(asked).not.toEqual([]);
    asked.length = 0;
    state.positions = [at("1", 195_000)];
    await pass(reading);

    expect(sent.map(({ text }) => [...text][0])).toEqual(["⏳", "⚠", "✅"]);
    expect(sent[0]?.text).not.toContain("seven days");
    expect(sent[0]?.text).not.toContain("Re-centring");
    expect(sent[2]?.text).not.toContain("seven days");
    expect(sent[2]?.text).not.toContain("Re-centring");
    expect(sent[2]?.text).toBe(enteredText(at("1", 195_000)));
    expect(asked).toEqual([]);
  });

  it("sends the alert all the same when the pair page's reads fail or throw — without that line", async () => {
    for (const failing of [
      readers({ searchV3: async () => Promise.reject(new Error("the gateway went away")) }).reading,
      readers({ nativeUsd: async () => ({ status: "unavailable", reason: "timeout", notice: "market-data-timed-out" }) }).reading,
    ]) {
      const { state, sent, pass } = await watching();
      await pass(failing);
      state.positions = [at("1", 180_000)];
      const summary = await pass(failing);

      expect(summary).toMatchObject({ alerts: 1, sent: 1 });
      expect(sent[0]?.text).not.toContain("seven days");
      expect(sent[0]?.text).toContain("Re-centring it on the current price");
      expect(sent[0]?.text.endsWith(en.footer)).toBe(true);
    }
  });

  it("gives no yield where the pool is under the pair page's floor, and the cost all the same", async () => {
    const { state, sent, pass } = await watching();
    const { reading } = readers({ nativeUsd: async () => ({ status: "success", data: 1 }) });
    await pass(reading);
    state.positions = [at("1", 180_000)];
    await pass(reading);

    expect(sent[0]?.text).not.toContain("seven days");
    expect(sent[0]?.text).toContain("Re-centring");
  });

  it("speaks the link's language", async () => {
    const { state, sent, pass } = await watching("tr");
    const { reading } = readers();
    await pass(reading);
    state.positions = [at("1", 210_000)];
    await pass(reading);

    expect(sent[0]?.text).toContain(getDictionary("tr").telegram.leftFeeYield("%3,65"));
    expect(sent[0]?.text).toContain("WETH takas etmek demek olurdu");
  });
});

/** The alert that a position is back inside its range, as it has always read: what happened, and the footer. */
const enteredText = (position: Position): string =>
  `${getDictionary("en").telegram.entered("USDC/WETH", "Uniswap v3", alertRange(position))}\n\n${getDictionary("en").telegram.footer}`;

const alertRange = (position: Position): string => {
  const quoted = [1 / position.upperPrice, 1 / position.lowerPrice].map((value) => formatPrice(value, "en"));
  return `${quoted[0]} – ${quoted[1]} USDC/WETH`;
};

describe("checkWatches and the pool watches", () => {
  const POOL = `0x${"c".repeat(40)}`;
  const TARGET = { protocol: "v3", chainId: 1, poolId: POOL } as const;
  const TOLD = [0.0003, 0.0005] as const;
  const WIDTH = Math.log(TOLD[1] / TOLD[0]);
  /** The lower edge moved by `share` of the told range's log-width. */
  const moved = (share: number): readonly [number, number] => [TOLD[0] * Math.exp(share * WIDTH), TOLD[1]];

  const reading = (range: readonly [number, number], target: PoolWatchTarget = TARGET): PoolRangeReading => ({
    ...target,
    pair: { token0: "USDC", token1: "WETH" },
    lpFeePpm: 500,
    currentPrice: 0.0004,
    range,
  });

  const watched = async (chatId = 99, target: PoolWatchTarget = TARGET, store = fakeStore()) => {
    await addPoolWatch(store, chatId, { target, range: TOLD, locale: "tr", now: new Date("2026-10-06T09:00:00.000Z") });
    return store;
  };

  type Ranges = Map<string, readonly [number, number] | null | "throws">;

  const passes = (store: ReturnType<typeof fakeStore>, state: { ranges: Ranges; time: string; delivers?: boolean }) => {
    const sent: { chatId: number; text: string }[] = [];
    const logged: string[] = [];
    const asked: PoolWatchTarget[] = [];
    const pass = () =>
      checkWatches({
        store,
        bot: {
          sendMessage: async (chatId, text) => {
            if (state.delivers === false) return false;
            sent.push({ chatId, text });
            return true;
          },
        },
        readPositions: async () => answer([]),
        dictionary: getDictionary,
        readSmartPairs: none,
        readSmartSeries: async () => null,
        now: () => new Date(state.time),
        readPoolRange: async (target) => {
          asked.push(target);
          const range = state.ranges.get(target.poolId);
          if (range === "throws") throw new Error("https://secret-rpc.example/key timed out");
          return range === null || range === undefined ? null : reading(range, target);
        },
        log: (line) => logged.push(line),
      });
    return { sent, logged, asked, pass };
  };

  it("reads each watched pool, and says nothing while the range sits within a tenth of the one told", async () => {
    const store = await watched();
    const { sent, asked, pass } = passes(store, { ranges: new Map([[POOL, moved(0.09)]]), time: "2026-10-07T09:00:00.000Z" });

    const summary = await pass();

    expect(asked).toEqual([TARGET]);
    expect(sent).toEqual([]);
    expect(summary).toMatchObject({ poolWatches: 1, poolsUnreadable: 0, poolAlerts: 0, watches: 0, alerts: 0 });
    expect((await readPoolWatches(store, 99))?.watches[0]?.told).toMatchObject({ lower: 0.0003, upper: 0.0005 });
  });

  it("tells the move once it passes a tenth, in the watch's language, with the range told then the new one, and keeps the new one as told", async () => {
    const store = await watched();
    const state = { ranges: new Map([[POOL, moved(0.11)]]), time: "2026-10-07T09:00:00.000Z" };
    const { sent, pass } = passes(store, state);

    const summary = await pass();

    expect(summary).toMatchObject({ poolWatches: 1, poolAlerts: 1 });
    expect(sent).toEqual([{ chatId: 99, text: poolRangeMovedText(reading(moved(0.11)), TOLD, getDictionary("tr"), "tr") }]);
    expect(sent[0]?.text).toContain(getDictionary("tr").telegram.footer);
    expect(sent[0]?.text).toContain(" → ");
    expect((await readPoolWatches(store, 99))?.watches[0]?.told).toEqual({ lower: moved(0.11)[0], upper: TOLD[1], at: "2026-10-07T09:00:00.000Z" });

    /* The same reading again: the baseline moved with the message, so there is nothing new to say. */
    state.time = "2026-10-09T09:00:00.000Z";
    expect((await pass()).poolAlerts).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("tells no pool more than once a day, however far the range goes on moving", async () => {
    const store = await watched();
    const state = { ranges: new Map([[POOL, moved(0.2)]]), time: "2026-10-07T09:00:00.000Z" };
    const { sent, pass } = passes(store, state);

    await pass();
    state.ranges.set(POOL, moved(0.6));
    state.time = "2026-10-08T08:59:00.000Z";
    expect((await pass()).poolAlerts).toBe(0);
    expect((await readPoolWatches(store, 99))?.watches[0]?.told.at).toBe("2026-10-07T09:00:00.000Z");

    state.time = "2026-10-08T09:00:00.000Z";
    expect((await pass()).poolAlerts).toBe(1);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.text).toBe(poolRangeMovedText(reading(moved(0.6)), moved(0.2), getDictionary("tr"), "tr"));
  });

  it("logs a pool that could not be read, or whose read threw, counts it, and goes on to the next", async () => {
    const other = { ...TARGET, poolId: `0x${"e".repeat(40)}` };
    const store = await watched();
    await watched(99, other, store);
    const ranges: Ranges = new Map();
    ranges.set(POOL, "throws");
    ranges.set(other.poolId, moved(0.3));
    const { sent, logged, pass } = passes(store, { ranges, time: "2026-10-07T09:00:00.000Z" });

    const summary = await pass();

    expect(summary).toMatchObject({ poolWatches: 2, poolsUnreadable: 1, poolAlerts: 1, storeUnavailable: false });
    expect(logged).toEqual([`[telegram] watched pool unreadable: v3 1 ${POOL}`]);
    expect(sent.map(({ text }) => text)).toEqual([poolRangeMovedText(reading(moved(0.3), other), TOLD, getDictionary("tr"), "tr")]);
    /* The unreadable pool keeps the range it was told, to be compared with next pass. */
    expect((await readPoolWatches(store, 99))?.watches[0]?.told).toMatchObject({ lower: 0.0003, upper: 0.0005 });

    ranges.set(POOL, null);
    expect(await pass()).toMatchObject({ poolsUnreadable: 1, poolAlerts: 0 });
    expect(logged).toHaveLength(2);
  });

  it("leaves a watch due when Telegram did not take the message", async () => {
    const store = await watched();
    const { pass } = passes(store, { ranges: new Map([[POOL, moved(0.3)]]), time: "2026-10-07T09:00:00.000Z", delivers: false });

    expect(await pass()).toMatchObject({ poolAlerts: 0 });
    expect((await readPoolWatches(store, 99))?.watches[0]?.told.at).toBe("2026-10-06T09:00:00.000Z");
  });

  it("runs the pool watches after the links on the same pass, each chat in its own language", async () => {
    const store = await linked();
    await watched(99, TARGET, store);
    await addPoolWatch(store, 7, { target: TARGET, range: TOLD, locale: "ar", now: new Date("2026-10-06T09:00:00.000Z") });
    const { sent, pass } = passes(store, { ranges: new Map([[POOL, moved(0.3)]]), time: "2026-10-07T09:00:00.000Z" });

    const summary = await pass();

    expect(summary).toMatchObject({ watches: 1, checked: 1, poolWatches: 2, poolAlerts: 2 });
    expect(sent.map(({ chatId }) => chatId).sort()).toEqual([7, 99]);
    expect(sent.find(({ chatId }) => chatId === 7)?.text).toContain(getDictionary("ar").telegram.footer);
  });

  it("logs and counts nothing when the set of watchers could not be read, with the links already checked", async () => {
    const store = await linked();
    const inner = store.smembers;
    const failing = Object.assign(store, {
      smembers: async (key: string) => (key === POOL_WATCHERS_KEY ? null : inner(key)),
    });
    const { logged, pass } = passes(failing, { ranges: new Map(), time: "2026-10-07T09:00:00.000Z" });

    expect(await pass()).toMatchObject({ watches: 1, poolWatches: 0, poolAlerts: 0, storeUnavailable: false });
    expect(logged).toEqual(["[telegram] the set of pool watchers could not be read; no pool was checked"]);
  });
});

describe("checkWatches within its budget", () => {
  /** A token for the n-th link: 22 characters, sorting in the order of n. */
  const tokenOf = (n: number): string => `tok${String(n).padStart(19, "0")}`;

  /** `links` claimed links, chat 1000 + n each, and `chats` chats watching five pools each. */
  const crowded = async (links: number, chats = 0) => {
    const store = fakeStore();
    for (let n = 0; n < links; n += 1) {
      await createPendingLink(store, tokenOf(n), { address: ADDRESS, locale: "tr", now: new Date() });
      await claimLink(store, tokenOf(n), 1_000 + n);
    }
    for (let chat = 0; chat < chats; chat += 1) {
      for (let n = 1; n <= 5; n += 1) {
        const target = { protocol: "v3", chainId: 1, poolId: `0x${String(n).padStart(40, "0")}` } as const;
        await addPoolWatch(store, 5_000 + chat, { target, range: [0.0003, 0.0005], locale: "tr", now: new Date("2026-10-06T09:00:00.000Z") });
      }
    }
    return store;
  };

  const pass = (store: ReturnType<typeof fakeStore>, cursor: PassCursor, read: { addresses: number; pools: number }, random = () => 0) =>
    checkWatches({
      store,
      bot: bot().client,
      readPositions: async () => {
        read.addresses += 1;
        return answer([]);
      },
      dictionary: getDictionary,
      ...noDigest,
      readPoolRange: async () => {
        read.pools += 1;
        return null;
      },
      log: () => {},
      readSmartPairs: none,
      cursor,
      random,
    });

  it("reads no more addresses and pools in one pass than its budget, however many there are", async () => {
    const store = await crowded(LINKS_PER_PASS * 2 + 7, POOLS_PER_PASS / 5 + 9);
    const read = { addresses: 0, pools: 0 };
    const summary = await pass(store, { links: null, pools: null }, read);

    expect(read.addresses).toBe(LINKS_PER_PASS);
    expect(read.pools).toBe(POOLS_PER_PASS);
    expect(summary).toMatchObject({ watches: LINKS_PER_PASS * 2 + 7, checked: LINKS_PER_PASS, poolWatches: POOLS_PER_PASS });
  });

  it("takes its turn, so every address and every pool is read within as many passes as there are budgets of them", async () => {
    const links = LINKS_PER_PASS * 2 + 7;
    const chats = POOLS_PER_PASS / 5 + 9;
    const store = await crowded(links, chats);
    const cursor: PassCursor = { links: null, pools: null };
    const addresses: string[] = [];
    const pools: number[] = [];

    for (let run = 0; run < 3; run += 1) {
      await checkWatches({
        store,
        bot: {
          sendMessage: async (chatId) => {
            pools.push(chatId);
            return true;
          },
        },
        readPositions: async (address) => {
          addresses.push(address);
          return answer([]);
        },
        dictionary: getDictionary,
        readSmartSeries: async () => null,
        now: () => new Date("2026-10-08T09:00:00.000Z"),
        /* Every pool far off what was told, so each one read is told, and the chat it was told to is counted. */
        readPoolRange: async (target) => ({ ...target, pair: { token0: "USDC", token1: "WETH" }, lpFeePpm: 500, currentPrice: 0.004, range: [0.003, 0.005] }),
        log: () => {},
        readSmartPairs: none,
        cursor,
        random: () => 0,
      });
    }

    expect(addresses).toHaveLength(LINKS_PER_PASS * 3);
    /* Three passes of fifty over a hundred and seven: once round, and the third stops forty-three into the next. */
    const tokens = [...(await store.smembers("liquiditywise:telegram:watches"))!].sort();
    expect(tokens).toHaveLength(links);
    expect(cursor.links).toBe(tokenOf(LINKS_PER_PASS * 3 - links - 1));
    expect(new Set(pools)).toEqual(new Set(Array.from({ length: chats }, (_, chat) => 5_000 + chat)));
  });

  it("starts a process's first pass at a place of chance, not at the top", async () => {
    const store = await crowded(LINKS_PER_PASS + 10);
    const cursor: PassCursor = { links: null, pools: null };
    const read = { addresses: 0, pools: 0 };

    await pass(store, cursor, read, () => 0.5);

    expect(cursor.links).not.toBe(tokenOf(LINKS_PER_PASS - 1));
  });

  it("gives every link made before chats had keys its key on its first pass, and leaves its mark", async () => {
    const store = fakeStore();
    for (let n = 0; n < LINKS_PER_PASS + 5; n += 1) {
      store.data.set(
        `liquiditywise:telegram:link:${tokenOf(n)}`,
        JSON.stringify({ address: ADDRESS, locale: "tr", chatId: 1_000 + n, createdAt: "2026-09-01T00:00:00.000Z", snapshot: null }),
      );
      await store.sadd("liquiditywise:telegram:watches", tokenOf(n));
    }

    await pass(store, { links: null, pools: null }, { addresses: 0, pools: 0 });

    expect(store.data.get(CHAT_INDEX_BUILT_KEY)).toBe("1");
    /* One read past the budget: its key was given by the walk, not by its turn. */
    const asked: string[] = [];
    const smembers = store.smembers;
    const watched = Object.assign(store, {
      smembers: async (key: string) => {
        asked.push(key);
        return smembers(key);
      },
    });
    expect((await findByChat(watched, 1_000 + LINKS_PER_PASS + 4))?.token).toBe(tokenOf(LINKS_PER_PASS + 4));
    expect(asked).toEqual([]);
  });
});
