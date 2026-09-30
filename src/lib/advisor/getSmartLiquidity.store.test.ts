import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * What getSmartLiquidity does with the store: keeps each measurement in it,
 * and puts the last one kept back after a restart.
 */

vi.mock("server-only", () => ({}));
vi.mock("../chains/chainEnvironment", () => ({
  rpcUrlFor: () => "https://rpc.example",
  v3SubgraphIdFor: () => "sub",
}));
vi.mock("./getMostTraded", () => ({ getMostTraded: async () => ({ v3: null, v4: null }) }));

const state = vi.hoisted(() => ({
  store: null as null | ReturnType<typeof import("../telegram/fakeStore").fakeStore>,
  kinds: "success" as "success" | "unavailable",
  outcome: "measured" as "measured" | "unavailable",
  reads: 0,
}));

vi.mock("../store/openStore", () => ({ openConfiguredStore: () => state.store }));
vi.mock("../uniswap/ethereumAddressKinds", () => ({
  fetchAddressKinds: async ({ addresses }: { addresses: string[] }) =>
    state.kinds === "success"
      ? { status: "success", data: new Map(addresses.map((address) => [address, "wallet"])) }
      : { status: "unavailable", reason: "timeout", notice: "chain-data-timed-out" },
}));

const POOL = {
  protocolVersion: "v3" as const,
  chainId: 1,
  id: `0x${"1".repeat(40)}`,
  feePpm: 500,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
};
const OWNER = `0x${"d".repeat(40)}`;
const measuredAt = (ageMs: number) => new Date(Date.now() - ageMs).toISOString();

const measured = (at: string) => ({
  status: "measured" as const,
  poolsAsked: 12,
  poolsRead: 12,
  measuredAt: at,
  data: {
    measured: 95,
    medianYearlyYield: 0.1,
    smartFrom: 0.2,
    smart: [
      { pool: POOL, tokenId: "7", owner: OWNER, valueUsd: 5e4, feesUsd: 400, days: 8, yearlyYield: 0.34, lowerPrice: 2250, upperPrice: 2750, currentPrice: 2500 },
    ],
    pairs: [
      { pool: POOL, positions: 1, valueUsd: 5e4, medianLowerRatio: 0.9, medianUpperRatio: 1.1, medianLowerPrice: 2250, medianUpperPrice: 2750, medianYearlyYield: 0.34, currentPrice: 2500 },
    ],
  },
});

vi.mock("./readSmartLiquidity", () => ({
  readSmartLiquidity: async () => {
    state.reads += 1;
    return state.outcome === "measured" ? measured(new Date().toISOString()) : { status: "unavailable", notice: "market-data-timed-out" };
  },
}));

import { fakeStore } from "../telegram/fakeStore";
import { forgetSmartLiquidity, getSmartLiquidity, hydrateSmartLiquidity, peekSmartLiquidity, SMART_LIQUIDITY_TTL_MS } from "./getSmartLiquidity";
import { readLatest, readOwnerSets, readSeries } from "./smartStore";

/** Lets what a read started in the background finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  forgetSmartLiquidity();
  Object.assign(state, { store: fakeStore(), kinds: "success", outcome: "measured", reads: 0 });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("keeping each measurement in the store", () => {
  it("writes the latest, a summary for the series, and the holders with their kinds", async () => {
    await getSmartLiquidity(1);
    await settle();

    const store = state.store!;
    expect((await readLatest(store, "ethereum"))?.data.smart[0]?.owner).toBe(OWNER);
    expect(await readSeries(store, "ethereum")).toHaveLength(1);
    expect((await readOwnerSets(store, "ethereum"))?.[0]).toMatchObject({ wallets: [OWNER], contracts: [] });
  });

  it("keeps the summary but no holders when their kinds could not be read", async () => {
    state.kinds = "unavailable";
    await getSmartLiquidity(1);
    await settle();

    expect(await readSeries(state.store!, "ethereum")).toHaveLength(1);
    expect(await readOwnerSets(state.store!, "ethereum")).toEqual([]);
  });

  it("keeps a failed read out of it", async () => {
    state.outcome = "unavailable";
    await getSmartLiquidity(1);
    await settle();

    expect(state.store!.data.size).toBe(0);
  });

  it("does nothing, and still answers, where the deployment keeps no store", async () => {
    state.store = null;

    expect(await getSmartLiquidity(1)).toMatchObject({ status: "measured" });
    await settle();
  });

  it("answers, and does not throw, when the store is down", async () => {
    state.store!.down = true;

    expect(await getSmartLiquidity(1)).toMatchObject({ status: "measured" });
    await settle();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("latest=false"));
  });
});

describe("after a restart", () => {
  const keep = async (ageMs: number) => {
    const { recordMeasurement } = await import("./smartStore");
    await recordMeasurement({
      store: state.store!,
      chain: "ethereum",
      read: measured(measuredAt(ageMs)),
      kinds: null,
    });
  };

  it("puts the measurement kept in the store back, dated from when it was made, so nothing is read", async () => {
    await keep(60 * 60 * 1000);

    expect(peekSmartLiquidity(1)).toBeNull();
    expect(await hydrateSmartLiquidity(1)).toBe(true);
    expect(peekSmartLiquidity(1)).toMatchObject({ status: "measured" });
    await getSmartLiquidity(1);
    expect(state.reads).toBe(0);
  });

  it("does not, when it is older than a measurement is good for, or from the future", async () => {
    await keep(SMART_LIQUIDITY_TTL_MS + 1000);
    expect(await hydrateSmartLiquidity(1)).toBe(false);

    await keep(-60 * 60 * 1000);
    expect(await hydrateSmartLiquidity(1)).toBe(false);
    expect(peekSmartLiquidity(1)).toBeNull();
  });

  it("does not, over one already in hand, on a chain without positions, without a store, or with the store down", async () => {
    await keep(1000);
    await getSmartLiquidity(1);
    expect(await hydrateSmartLiquidity(1)).toBe(false);

    expect(await hydrateSmartLiquidity(42161)).toBe(false);
    forgetSmartLiquidity();
    state.store!.down = true;
    expect(await hydrateSmartLiquidity(1)).toBe(false);
    state.store = null;
    expect(await hydrateSmartLiquidity(1)).toBe(false);
  });

  it("finds nothing where nothing was kept", async () => {
    expect(await hydrateSmartLiquidity(1)).toBe(false);
  });
});
