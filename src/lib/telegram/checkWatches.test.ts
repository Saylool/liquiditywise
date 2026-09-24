import { describe, expect, it } from "vitest";

import type { AddressPositionsResult } from "../advisor/addressPositions";
import type { Position } from "../../schemas";
import { getDictionary } from "../i18n/dictionaries";
import type { BotClient } from "./botApi";
import { checkWatches } from "./checkWatches";
import { fakeStore } from "./fakeStore";
import { claimLink, createPendingLink, readLink } from "./links";

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
      dictionary: getDictionary,
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
      checkWatches({ store, bot: client, readPositions: async () => answer(read.positions), dictionary: getDictionary });

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
    await checkWatches({ store, bot: client, readPositions: async () => answer([position("1", true)]), dictionary: getDictionary });

    const summary = await checkWatches({
      store,
      bot: client,
      readPositions: async () => ({ status: "unavailable", notice: "positions-unreadable" }),
      dictionary: getDictionary,
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
      checkWatches({ store, bot: failing, readPositions: async () => answer(read.positions), dictionary: getDictionary });

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
      dictionary: getDictionary,
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
      checkWatches({ store, bot: client, readPositions: async () => answer([at(tick)]), dictionary: getDictionary });

    await pass(2500);
    await pass(5000);
    // Back a little, still within a fifth of the width of the edge, then close again: one warning, not two.
    await pass(4200);
    await pass(5000);

    expect(sent.map(({ text }) => [...text][0])).toEqual(["⏳"]);
    expect((await readLink(store, TOKEN))?.snapshot).toEqual({ "v3:7": "near" });
  });
});
