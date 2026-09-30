import { describe, expect, it } from "vitest";

import type { V3PoolMetadata } from "../../schemas";
import {
  appendTo,
  MIN_GAP_MS,
  MIN_OWNER_SETS,
  MIN_TREND_MS,
  MOVERS_SHOWN,
  OWNER_SETS_MAX,
  ownerSetOf,
  type OwnerSet,
  persistentHolders,
  PERSISTENT_SHOWN,
  SERIES_MAX,
  snapshotOf,
  type SmartSnapshot,
  type SnapshotPair,
  TREND_PAIRS,
  TREND_WINDOW_MS,
  trendOf,
} from "./smartHistory";
import type { MeasuredPosition, SmartLiquidity } from "./smartLiquidity";

const HOUR = 3_600_000;
const T0 = Date.parse("2026-09-20T00:00:00Z");
const at = (hours: number) => new Date(T0 + hours * HOUR).toISOString();

const pool = (index: number, symbols: [string, string] = ["USDC", "WETH"]): V3PoolMetadata => ({
  protocolVersion: "v3",
  chainId: 1,
  id: `0x${index.toString(16).padStart(40, "0").toUpperCase().replace(/^0X/, "")}`,
  feePpm: 500,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: symbols[0], decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: symbols[1], decimals: 18 },
});

const pair = (index: number, valueUsd: number, overrides: Partial<SnapshotPair> = {}): SnapshotPair => ({
  pool: `0x${index.toString(16).padStart(40, "0")}`,
  pair: `T${index} / WETH`,
  feePpm: 500,
  positions: 3,
  valueUsd,
  lowerPrice: 90,
  upperPrice: 110,
  currentPrice: 100,
  yearlyYield: 0.3,
  ...overrides,
});

const snapshot = (hours: number, pairs: SnapshotPair[]): SmartSnapshot => ({
  at: at(hours),
  measured: 100,
  smart: 20,
  medianYearlyYield: 0.1,
  smartFrom: 0.2,
  pairs,
});

const owned = (owner: string): MeasuredPosition =>
  ({ owner, tokenId: owner, pool: pool(1), valueUsd: 1, feesUsd: 1, days: 5, yearlyYield: 0.4, lowerPrice: 1, upperPrice: 2, currentPrice: 1.5 }) as MeasuredPosition;

describe("what a measurement keeps", () => {
  it("is each pair's summary with its median edges as prices, and the pool's address lower-cased", () => {
    const data: SmartLiquidity = {
      measured: 683,
      medianYearlyYield: 0.09,
      smartFrom: 0.21,
      smart: [owned("0xA")],
      pairs: [
        {
          pool: pool(255),
          positions: 4,
          valueUsd: 5_000,
          medianLowerRatio: 0.9,
          medianUpperRatio: 1.1,
          medianLowerPrice: 2_250,
          medianUpperPrice: 2_750,
          medianYearlyYield: 0.33,
          currentPrice: 2_500,
        },
      ],
    };

    expect(snapshotOf(data, at(0))).toEqual({
      at: at(0),
      measured: 683,
      smart: 1,
      medianYearlyYield: 0.09,
      smartFrom: 0.21,
      pairs: [
        {
          pool: `0x${"ff".padStart(40, "0")}`,
          pair: "USDC / WETH",
          feePpm: 500,
          positions: 4,
          valueUsd: 5_000,
          lowerPrice: 2_250,
          upperPrice: 2_750,
          currentPrice: 2_500,
          yearlyYield: 0.33,
        },
      ],
    });
  });

  it("splits the smart holders into wallets and contracts, each once, lower-cased, and leaves out those whose kind is unknown", () => {
    const data = { measured: 1, medianYearlyYield: null, smartFrom: null, pairs: [], smart: [owned("0xAA"), owned("0xaa"), owned("0xBB"), owned("0xCC")] } as SmartLiquidity;
    const kinds = new Map<string, "wallet" | "contract">([
      ["0xaa", "wallet"],
      ["0xbb", "contract"],
    ]);

    expect(ownerSetOf(data, at(0), kinds)).toEqual({ at: at(0), wallets: ["0xaa"], contracts: ["0xbb"] });
  });
});

describe("keeping a series", () => {
  it("adds each measurement, keeps the newest ones and no more", () => {
    let series: SmartSnapshot[] = [];
    for (let index = 0; index < SERIES_MAX + 5; index += 1) series = appendTo(series, snapshot(index * 6, []), SERIES_MAX);

    expect(series).toHaveLength(SERIES_MAX);
    expect(series[series.length - 1]?.at).toBe(at((SERIES_MAX + 4) * 6));
    expect(series[0]?.at).toBe(at(5 * 6));
  });

  it("replaces the last when the next is inside the gap, and adds it when it is not", () => {
    const first = snapshot(0, [pair(1, 1)]);
    const close = { ...snapshot(0, [pair(1, 2)]), at: new Date(T0 + MIN_GAP_MS - 1).toISOString() };
    const apart = { ...snapshot(0, [pair(1, 3)]), at: new Date(T0 + MIN_GAP_MS).toISOString() };

    expect(appendTo([first], close, 10).map(({ pairs }) => pairs[0]?.valueUsd)).toEqual([2]);
    expect(appendTo([first], apart, 10).map(({ pairs }) => pairs[0]?.valueUsd)).toEqual([1, 3]);
  });
});

describe("how the smart liquidity moved", () => {
  const week = (build: (hours: number) => SnapshotPair[]) =>
    Array.from({ length: 8 }, (_unused, day) => snapshot(day * 24, build(day * 24)));

  it("says nothing before a day lies between the first measurement it compares and the last", () => {
    expect(trendOf([])).toBeNull();
    expect(trendOf([snapshot(0, [pair(1, 1)])])).toBeNull();
    expect(trendOf([snapshot(0, [pair(1, 1)]), snapshot(MIN_TREND_MS / HOUR - 1, [pair(1, 1)])])).toBeNull();
    expect(trendOf([snapshot(0, [pair(1, 1)]), snapshot(MIN_TREND_MS / HOUR, [pair(1, 1)])])).not.toBeNull();
  });

  it("compares the latest with the first measurement inside the week, however long the series is", () => {
    const series = [snapshot(-1000, [pair(1, 1)]), ...week(() => [pair(1, 1)])];
    const trend = trendOf(series);

    expect(trend?.since).toBe(at(0));
    expect(trend?.days).toBe(7);
    expect(Date.parse(at(7 * 24)) - Date.parse(trend?.since ?? "")).toBeLessThanOrEqual(TREND_WINDOW_MS);
  });

  it("gives a pair's range then and now as its edges over the price of its own moment, so a price move alone shows no shift", () => {
    /* The whole range doubled with the price: the same shape, and the same ratios. */
    const series = [
      snapshot(0, [pair(1, 100, { lowerPrice: 90, upperPrice: 110, currentPrice: 100 })]),
      snapshot(48, [pair(1, 100, { lowerPrice: 180, upperPrice: 220, currentPrice: 200 })]),
    ];
    const [first] = trendOf(series)?.pairs ?? [];

    expect(first?.then).toEqual({ lowerRatio: 0.9, upperRatio: 1.1 });
    expect(first?.now).toEqual({ lowerRatio: 0.9, upperRatio: 1.1 });
    expect(first?.currentPrice).toBe(200);
  });

  it("gives the range's width at every measurement the pair was in, oldest first, and skips those it was not", () => {
    const series = [
      snapshot(0, [pair(1, 1, { lowerPrice: 90, upperPrice: 110 })]),
      snapshot(24, [pair(2, 1)]),
      snapshot(48, [pair(1, 1, { lowerPrice: 80, upperPrice: 120 })]),
    ];
    const [first] = trendOf(series)?.pairs ?? [];

    expect(first?.widths[0]).toBeCloseTo(110 / 90 - 1, 12);
    expect(first?.widths[1]).toBeCloseTo(120 / 80 - 1, 12);
    expect(first?.widths).toHaveLength(2);
  });

  it("gives each pair's share of the smart money then and now, `null` for one that was not there", () => {
    const series = [snapshot(0, [pair(1, 75), pair(2, 25)]), snapshot(48, [pair(1, 40), pair(2, 40), pair(3, 20)])];
    const shares = Object.fromEntries((trendOf(series)?.pairs ?? []).map(({ pair: name, shareThen, shareNow }) => [name, [shareThen, shareNow]]));

    expect(shares).toEqual({ "T1 / WETH": [0.75, 0.4], "T2 / WETH": [0.25, 0.4], "T3 / WETH": [null, 0.2] });
  });

  it("follows the biggest pairs only, most money first", () => {
    const many = Array.from({ length: TREND_PAIRS + 4 }, (_unused, index) => pair(index + 1, (index + 1) * 10));
    const trend = trendOf([snapshot(0, many), snapshot(48, many)]);

    expect(trend?.pairs).toHaveLength(TREND_PAIRS);
    expect(trend?.pairs[0]?.pair).toBe(`T${TREND_PAIRS + 4} / WETH`);
  });

  it("names the pairs whose share grew and shrank most, counts one that left as shrinking, and ignores a small move", () => {
    const then = [pair(1, 40), pair(2, 30), pair(3, 20), pair(4, 9), pair(5, 1)];
    const now = [pair(1, 10), pair(2, 30), pair(4, 30), pair(5, 1.5), pair(6, 28.5)];
    const trend = trendOf([snapshot(0, then), snapshot(48, now)]);

    expect(trend?.gaining.map(({ pair: name }) => name)).toEqual(["T6 / WETH", "T4 / WETH"]);
    expect(trend?.losing.map(({ pair: name }) => name)).toEqual(["T1 / WETH", "T3 / WETH"]);
    expect(trend?.losing.find(({ pair: name }) => name === "T3 / WETH")).toMatchObject({ from: 0.2, to: 0 });
    expect(trend?.gaining.find(({ pair: name }) => name === "T6 / WETH")).toMatchObject({ from: 0 });
    expect([...(trend?.gaining ?? []), ...(trend?.losing ?? [])].map(({ pair: name }) => name)).not.toContain("T5 / WETH");
  });

  it("names at most a few movers each way", () => {
    const then = Array.from({ length: 8 }, (_unused, index) => pair(index + 1, index < 4 ? 100 : 0.001));
    const now = Array.from({ length: 8 }, (_unused, index) => pair(index + 1, index < 4 ? 0.001 : 100));
    const trend = trendOf([snapshot(0, then), snapshot(48, now)]);

    expect(trend?.gaining).toHaveLength(MOVERS_SHOWN);
    expect(trend?.losing).toHaveLength(MOVERS_SHOWN);
  });
});

describe("the holders who keep turning up", () => {
  const sets = (count: number, build: (index: number) => Partial<OwnerSet>): OwnerSet[] =>
    Array.from({ length: count }, (_unused, index) => ({ at: at(index * 6), wallets: [], contracts: [], ...build(index) }));

  it("is unknown before enough measurements to say", () => {
    expect(persistentHolders(sets(MIN_OWNER_SETS - 1, () => ({ wallets: ["0xa"] })))).toBeNull();
    expect(persistentHolders(sets(MIN_OWNER_SETS, () => ({ wallets: ["0xa"] })))).toEqual([
      { address: "0xa", appeared: MIN_OWNER_SETS, of: MIN_OWNER_SETS, contract: false },
    ]);
  });

  it("lists those in at least half of the measurements, most often first, and marks contracts", () => {
    const list = persistentHolders(
      sets(10, (index) => ({
        wallets: [...(index < 9 ? ["0xb"] : []), ...(index < 5 ? ["0xa"] : []), ...(index < 4 ? ["0xdead"] : [])],
        contracts: index < 7 ? ["0xvault"] : [],
      })),
    );

    expect(list).toEqual([
      { address: "0xb", appeared: 9, of: 10, contract: false },
      { address: "0xvault", appeared: 7, of: 10, contract: true },
      { address: "0xa", appeared: 5, of: 10, contract: false },
    ]);
  });

  it("counts only the last week's measurements", () => {
    const list = persistentHolders(sets(OWNER_SETS_MAX + 10, (index) => (index < 10 ? { wallets: ["0xold"] } : { wallets: ["0xnew"] })));

    expect(list?.map(({ address }) => address)).toEqual(["0xnew"]);
    expect(list?.[0]?.of).toBe(OWNER_SETS_MAX);
  });

  it("lists a bounded number, and breaks a tie by address", () => {
    const list = persistentHolders(sets(MIN_OWNER_SETS, () => ({ wallets: Array.from({ length: PERSISTENT_SHOWN + 5 }, (_unused, index) => `0x${String(index).padStart(2, "0")}`) })));

    expect(list).toHaveLength(PERSISTENT_SHOWN);
    expect(list?.[0]?.address).toBe("0x00");
  });

  it("takes an address to be a contract if the latest measurement says so", () => {
    const list = persistentHolders(sets(MIN_OWNER_SETS, (index) => (index < MIN_OWNER_SETS - 1 ? { wallets: ["0xa"] } : { contracts: ["0xa"] })));

    expect(list?.[0]).toMatchObject({ address: "0xa", contract: true });
  });
});
