import { describe, expect, it } from "vitest";

import type { AddressPositionsResult } from "../advisor/addressPositions";
import type { Position } from "../../schemas";
import { getDictionary } from "../i18n/dictionaries";
import type { BotClient } from "./botApi";
import { checkWatches } from "./checkWatches";
import { fakeStore } from "./fakeStore";
import type { SmartPair } from "../analytics/smartLiquidity";
import { claimLink, createPendingLink, readLink, setSmartAlerts } from "./links";

/** No measurement kept: the position alerts under test are all these passes have to say. */
const none = () => new Map<string, never>();

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
      dictionary: getDictionary, readSmartPairs: none,
    });

    expect(asked).toEqual([ADDRESS]);
    expect(sent).toEqual([]);
    expect(summary).toEqual({ watches: 1, checked: 1, unreadable: 0, alerts: 0, sent: 0, storeUnavailable: false });
    expect((await readLink(store, TOKEN))?.snapshot).toEqual({ "v3:1": true });
  });

  it("sends one message per change, in the link's language, and moves the snapshot on", async () => {
    const store = await linked();
    const { client, sent } = bot();
    const read = { positions: [position("1", true)] };
    const check = () =>
      checkWatches({ store, bot: client, readPositions: async () => answer(read.positions), dictionary: getDictionary, readSmartPairs: none });

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
    await checkWatches({ store, bot: client, readPositions: async () => answer([position("1", true)]), dictionary: getDictionary, readSmartPairs: none });

    const summary = await checkWatches({
      store,
      bot: client,
      readPositions: async () => ({ status: "unavailable", notice: "positions-unreadable" }),
      dictionary: getDictionary, readSmartPairs: none,
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
      checkWatches({ store, bot: failing, readPositions: async () => answer(read.positions), dictionary: getDictionary, readSmartPairs: none });

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
      dictionary: getDictionary, readSmartPairs: none,
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
      checkWatches({ store, bot: client, readPositions: async () => answer([at(tick)]), dictionary: getDictionary, readSmartPairs: none });

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
      dictionary: getDictionary, readSmartPairs: none,
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
      checkWatches({ store, bot: client, readPositions: async () => answer(positions), dictionary: getDictionary, readSmartPairs: none });

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
        dictionary: getDictionary,
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
        dictionary: getDictionary,
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
      dictionary: getDictionary,
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
      dictionary: getDictionary,
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
      dictionary: getDictionary,
      readSmartPairs: () => kept.pairs,
    });

    expect((await readLink(store, TOKEN))?.smart?.ranges).toEqual({ [POOL]: [0.0003, 0.0005] });
  });
});
