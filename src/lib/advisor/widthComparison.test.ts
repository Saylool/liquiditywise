import { describe, expect, it } from "vitest";

import type { DataResult, PoolDailyPriceHistory, PoolMarketSnapshot, V3Pool } from "../../schemas";
import { analysePoolRange, DEFAULT_PRICE_BAND_PARAMETERS, type PoolRangeAnalysis } from "./poolRangeAnalysis";
import { MULTIPLIER_CHOICES } from "./requestedParameters";
import { relativeFeeShare } from "../analytics/rangeConcentration";
import { comparedWidths, compareWidths } from "./widthComparison";

const POOL_ID = `0x${"c".repeat(40)}`;
const POOL_REF = { protocolVersion: "v3", chainId: 1, id: POOL_ID } as const;
const FETCHED_AT = "2026-08-21T09:15:00.000Z";
const CURRENT_PRICE = 1 / 3000;
const DAY_MS = 86_400_000;
const RANGE_END = Date.parse("2026-08-21T00:00:00.000Z");

const pool = (): V3Pool =>
  ({
    ...POOL_REF,
    token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
    token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
    feePpm: 3000,
    tickSpacing: 60,
  }) as unknown as V3Pool;

const snapshot = (): PoolMarketSnapshot =>
  ({
    pool: POOL_REF,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    token0PriceInToken1: CURRENT_PRICE,
    token1PriceInToken0: 1 / CURRENT_PRICE,
    tvlUsd: 12_500_000,
    tick: 196_256,
    liquidity: "987654321",
    source: "uniswap-v3-subgraph",
  }) as unknown as PoolMarketSnapshot;

/**
 * `days` closes ending at the current price, walked backwards from it in
 * four-percent steps, seven of every eleven the same way — so the older days
 * drift away from the price the range is centred on. Enough of the month
 * then sits outside a tight range and inside a wide one, which is what the
 * widths have to differ on.
 */
const history = (days: number): PoolDailyPriceHistory => {
  const start = RANGE_END - days * DAY_MS;
  const closes: number[] = new Array<number>(days);
  closes[days - 1] = CURRENT_PRICE;
  for (let day = days - 2; day >= 0; day -= 1) {
    const step = (day * 7) % 11 < 7 ? 1.04 : 1 / 1.04;
    closes[day] = (closes[day + 1] ?? CURRENT_PRICE) * step;
  }
  const points = closes.map((price, day) => ({
    timestamp: new Date(start + day * DAY_MS).toISOString(),
    price,
    low: price / 1.004,
    high: price * 1.004,
    volumeUsd: 1_000_000,
    feesUsd: 3_000,
  }));
  return {
    pool: POOL_REF,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    rangeStart: new Date(start).toISOString(),
    rangeEndExclusive: new Date(RANGE_END).toISOString(),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points,
    source: "uniswap-v3-subgraph",
  } as unknown as PoolDailyPriceHistory;
};

const ok = <T,>(data: T): DataResult<T> => ({ status: "success", data });

const analysis = (days = 121, standardDeviationMultiplier = 1): PoolRangeAnalysis => {
  const result = analysePoolRange({
    pool: ok(pool()),
    snapshot: ok(snapshot()),
    history: ok(history(days)),
    parameters: { ...DEFAULT_PRICE_BAND_PARAMETERS, standardDeviationMultiplier },
  });
  if (result.status === "unavailable") throw new Error(`fixture should analyse: ${result.notice}`);
  return result.data;
};

describe("comparedWidths", () => {
  it("is every offered width, ascending", () => {
    expect(comparedWidths(1.5)).toEqual([...MULTIPLIER_CHOICES]);
  });

  it("adds a width typed into the URL, in its place", () => {
    expect(comparedWidths(2.5)).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(comparedWidths(0.5)).toEqual([0.5, 1, 1.5, 2, 3]);
  });
});

describe("compareWidths", () => {
  it("compares every offered width, ascending, with the chosen one marked", () => {
    const rows = compareWidths(analysis(121, 1.5));

    expect(rows.map((row) => row.standardDeviationMultiplier)).toEqual([...MULTIPLIER_CHOICES]);
    expect(rows.map((row) => row.chosen)).toEqual([false, true, false, false]);
  });

  /*
   * The chosen row is recomputed rather than copied, and it must come out as
   * the page's own figures — the same calculators on the same inputs — or the
   * table would disagree with the range above it.
   */
  it("recomputes the chosen width to exactly the page's own figures", () => {
    const shown = analysis(121, 2);
    const chosen = compareWidths(shown).find((row) => row.chosen);

    expect(chosen?.range).toEqual(shown.range);
    expect(chosen?.occupancy).toEqual(shown.activity.occupancy);
    expect(chosen?.daysMeasured).toBe(shown.activity.daysMeasured);
    expect(shown.outOfSample.status).toBe("success");
    expect(chosen?.outOfSample).toEqual(shown.outOfSample.status === "success" ? shown.outOfSample.data : null);
  });

  it("adds a width typed into the URL beside the offered ones, and marks it", () => {
    const rows = compareWidths(analysis(121, 2.5));

    expect(rows.map((row) => row.standardDeviationMultiplier)).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(rows.find((row) => row.chosen)?.standardDeviationMultiplier).toBe(2.5);
  });

  /* The trade-off the table exists to show: each wider range contains the narrower one and holds no fewer days. */
  it("draws each wider range around the narrower one, holding no fewer of the days", () => {
    const rows = compareWidths(analysis());

    for (let index = 1; index < rows.length; index += 1) {
      const narrower = rows[index - 1];
      const wider = rows[index];
      if (narrower === undefined || wider === undefined) throw new Error("fewer rows than widths");
      expect(wider.range.lowerPrice).toBeLessThanOrEqual(narrower.range.lowerPrice);
      expect(wider.range.upperPrice).toBeGreaterThanOrEqual(narrower.range.upperPrice);
      expect(wider.occupancy.fullyInside).toBeGreaterThanOrEqual(narrower.occupancy.fullyInside);
      expect(wider.occupancy.fullyOutside).toBeLessThanOrEqual(narrower.occupancy.fullyOutside);
    }
    expect(rows[0]?.occupancy.fullyInside).toBeLessThan(rows[rows.length - 1]?.occupancy.fullyInside ?? 0);
  });

  it("counts the days over the same month the activity figures use", () => {
    const rows = compareWidths(analysis(121));

    for (const row of rows) {
      expect(row.daysMeasured).toBe(30);
      expect(row.occupancy.fullyInside + row.occupancy.fullyOutside + row.occupancy.undetermined).toBe(30);
    }
  });

  it("checks each width on days it never saw, at that width", () => {
    const rows = compareWidths(analysis(121));

    for (const row of rows) {
      expect(row.outOfSample?.standardDeviationMultiplier).toBe(row.standardDeviationMultiplier);
      expect(row.outOfSample?.horizonDays).toBe(DEFAULT_PRICE_BAND_PARAMETERS.horizonDays);
      expect(row.outOfSample?.folds.length).toBeGreaterThan(0);
    }
  });

  it("says when the history had no room to check a width", () => {
    const rows = compareWidths(analysis(31));

    expect(rows).toHaveLength(MULTIPLIER_CHOICES.length);
    expect(rows.every((row) => row.outOfSample === null)).toBe(true);
  });
});

/*
 * The column that makes "spread thinner" a number: what the same deposit takes
 * of a day's fees in each width, against the width the page is showing.
 */
describe("compareWidths and the fee share", () => {
  it("reads as one for the width being shown", () => {
    const rows = compareWidths(analysis(121, 1.5));

    expect(rows.find((row) => row.chosen)?.relativeFeeShare).toBeCloseTo(1, 12);
  });

  it("gives a narrower width more of the fees and a wider one less, in order", () => {
    const rows = compareWidths(analysis(121, 1.5));
    const shares = rows.map((row) => row.relativeFeeShare ?? 0);

    expect(shares[0]).toBeGreaterThan(1);
    expect(shares[2]).toBeLessThan(1);
    expect(shares[3]).toBeLessThan(shares[2] ?? 0);
    for (let index = 1; index < shares.length; index += 1) {
      expect(shares[index]).toBeLessThan(shares[index - 1] ?? 0);
    }
  });

  /* The figure is the protocol's own arithmetic, so it can be recomputed from the two ranges alone. */
  it("is the liquidity the same deposit buys in each range, at the current price", () => {
    const shown = analysis(121, 1);
    const rows = compareWidths(shown);
    const widest = rows[rows.length - 1];
    const chosen = rows.find((row) => row.chosen);
    if (widest === undefined || chosen === undefined) throw new Error("expected both rows");

    expect(widest.relativeFeeShare).toBeCloseTo(
      relativeFeeShare(widest.range, chosen.range, shown.band.currentPrice) ?? 0,
      12,
    );
  });
});
