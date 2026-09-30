import { describe, expect, it } from "vitest";

import type { V3PoolMetadata } from "../../schemas";
import { SERIES_MAX } from "../analytics/smartHistory";
import type { MeasuredPosition } from "../analytics/smartLiquidity";
import { fakeStore } from "../telegram/fakeStore";
import type { SmartLiquidityRead } from "./readSmartLiquidity";
import { readLatest, readOwnerSets, readSeries, recordMeasurement } from "./smartStore";

const POOL: V3PoolMetadata = {
  protocolVersion: "v3",
  chainId: 1,
  id: `0x${"1".repeat(40)}`,
  feePpm: 500,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
};
const OWNER = `0x${"d".repeat(40)}`;
const T0 = Date.parse("2026-09-28T00:00:00Z");
const at = (hours: number) => new Date(T0 + hours * 3_600_000).toISOString();

const position = (owner = OWNER): MeasuredPosition => ({
  pool: POOL,
  tokenId: "7",
  owner,
  valueUsd: 50_000,
  feesUsd: 400,
  days: 8,
  yearlyYield: 0.34,
  lowerPrice: 2_250,
  upperPrice: 2_750,
  currentPrice: 2_500,
});

const measured = (hours: number, owner = OWNER): Extract<SmartLiquidityRead, { status: "measured" }> => ({
  status: "measured",
  poolsAsked: 12,
  poolsRead: 12,
  measuredAt: at(hours),
  data: {
    measured: 95,
    medianYearlyYield: 0.1,
    smartFrom: 0.2,
    smart: [position(owner)],
    pairs: [
      {
        pool: POOL,
        positions: 1,
        valueUsd: 50_000,
        medianLowerRatio: 0.9,
        medianUpperRatio: 1.1,
        medianLowerPrice: 2_250,
        medianUpperPrice: 2_750,
        medianYearlyYield: 0.34,
        currentPrice: 2_500,
      },
    ],
  },
});

const KINDS = new Map<string, "wallet" | "contract">([[OWNER, "wallet"]]);

describe("keeping a measurement", () => {
  it("keeps the latest in full, so that what is read back is what was written", async () => {
    const store = fakeStore();
    const read = measured(0);

    expect(await recordMeasurement({ store, chain: "ethereum", read, kinds: KINDS })).toEqual({ latest: true, series: true, owners: true });
    expect(await readLatest(store, "ethereum")).toEqual(read);
    expect(await readLatest(store, "polygon")).toBeNull();
  });

  it("adds a summary to the series and the holders to the owner sets, each measurement after the last", async () => {
    const store = fakeStore();
    await recordMeasurement({ store, chain: "ethereum", read: measured(0), kinds: KINDS });
    await recordMeasurement({ store, chain: "ethereum", read: measured(6), kinds: KINDS });

    expect((await readSeries(store, "ethereum"))?.map(({ at: when }) => when)).toEqual([at(0), at(6)]);
    expect(await readOwnerSets(store, "ethereum")).toEqual([
      { at: at(0), wallets: [OWNER], contracts: [] },
      { at: at(6), wallets: [OWNER], contracts: [] },
    ]);
  });

  it("keeps each chain's apart", async () => {
    const store = fakeStore();
    await recordMeasurement({ store, chain: "ethereum", read: measured(0), kinds: KINDS });
    await recordMeasurement({ store, chain: "polygon", read: measured(1), kinds: KINDS });

    expect((await readSeries(store, "ethereum"))?.[0]?.at).toBe(at(0));
    expect((await readSeries(store, "polygon"))?.[0]?.at).toBe(at(1));
  });

  it("adds no holders when their kinds could not be read, but still adds the summary", async () => {
    const store = fakeStore();
    const outcome = await recordMeasurement({ store, chain: "ethereum", read: measured(0), kinds: null });

    expect(outcome).toEqual({ latest: true, series: true, owners: false });
    expect(await readSeries(store, "ethereum")).toHaveLength(1);
    expect(await readOwnerSets(store, "ethereum")).toEqual([]);
  });

  it("keeps a bounded series", async () => {
    const store = fakeStore();
    for (let index = 0; index < SERIES_MAX + 3; index += 1) {
      await recordMeasurement({ store, chain: "ethereum", read: measured(index * 6), kinds: null });
    }

    expect(await readSeries(store, "ethereum")).toHaveLength(SERIES_MAX);
  });

  it("says which writes did not take when the store is down, and reads null rather than an empty series", async () => {
    const store = fakeStore();
    store.down = true;

    expect(await recordMeasurement({ store, chain: "ethereum", read: measured(0), kinds: KINDS })).toEqual({ latest: false, series: false, owners: false });
    expect(await readSeries(store, "ethereum")).toBeNull();
    expect(await readOwnerSets(store, "ethereum")).toBeNull();
    expect(await readLatest(store, "ethereum")).toBeNull();
  });

  it("starts again from nothing when what is kept is not what was written", async () => {
    const store = fakeStore();
    store.data.set("liquiditywise:smart:ethereum:series", "{not json");
    store.data.set("liquiditywise:smart:ethereum:owners", JSON.stringify([{ at: 1 }]));
    store.data.set("liquiditywise:smart:ethereum:latest", JSON.stringify({ status: "measured" }));

    expect(await readSeries(store, "ethereum")).toEqual([]);
    expect(await readOwnerSets(store, "ethereum")).toEqual([]);
    expect(await readLatest(store, "ethereum")).toBeNull();
    await recordMeasurement({ store, chain: "ethereum", read: measured(0), kinds: KINDS });
    expect(await readSeries(store, "ethereum")).toHaveLength(1);
  });
});
