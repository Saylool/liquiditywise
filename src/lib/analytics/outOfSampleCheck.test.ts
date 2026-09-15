import { describe, expect, it } from "vitest";

import type { PoolDailyPriceHistory } from "../../schemas";
import { calculateOutOfSampleCheck } from "./outOfSampleCheck";

const DAY_MS = 86_400_000;
const START = Date.parse("2026-05-01T00:00:00.000Z");
const at = (index: number) => new Date(START + index * DAY_MS).toISOString();

type DayOverride = { price?: number; low?: number | null; high?: number | null };

/**
 * A history of `dayCount` days, priced by `priceAt`.
 *
 * Extremes bracket each day's own price by ±1% unless a case needs otherwise,
 * because the schema requires a day's price to sit between its own extremes.
 */
const historyOf = (
  dayCount: number,
  priceAt: (index: number) => number,
  overrideAt: (index: number) => DayOverride = () => ({}),
  presentDays?: readonly number[],
): PoolDailyPriceHistory => {
  const days = presentDays ?? Array.from({ length: dayCount }, (_unused, index) => index);

  return {
    pool: { protocolVersion: "v3", chainId: 1, id: `0x${"a".repeat(40)}` },
    fetchedAt: at(dayCount),
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: at(dayCount),
    rangeStart: at(0),
    rangeEndExclusive: at(dayCount),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points: days.map((index) => {
      const price = priceAt(index);
      const override = overrideAt(index);

      return {
        timestamp: at(index),
        price: override.price ?? price,
        low: override.low === undefined ? (override.price ?? price) * 0.99 : override.low,
        high: override.high === undefined ? (override.price ?? price) * 1.01 : override.high,
        volumeUsd: 1_000,
        feesUsd: 5,
      };
    }),
    source: "uniswap-v3-subgraph",
  } as PoolDailyPriceHistory;
};

/** Enough days for a 31-close fit plus a 30-day test, which is 61. */
const wobbling = (index: number) => 1_000 * (1 + 0.01 * Math.sin(index));

const parameters = { horizonDays: 30, standardDeviationMultiplier: 1 };

const succeeded = (result: ReturnType<typeof calculateOutOfSampleCheck>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.notice}`);
  return result.data;
};

/** Folds are published oldest first, so the most recent one is last. */
const newest = (result: ReturnType<typeof calculateOutOfSampleCheck>) => {
  const fold = succeeded(result).folds.at(-1);
  if (fold === undefined) throw new Error("expected at least one fold");
  return fold;
};

describe("calculateOutOfSampleCheck", () => {
  it("fits on the days before the test and measures the days after", () => {
    const data = newest(
      calculateOutOfSampleCheck({ history: historyOf(61, wobbling), parameters }),
    );

    expect(data.fitRangeStart).toBe(at(0));
    expect(data.fitRangeEndExclusive).toBe(at(31));
    expect(data.measuredRangeStart).toBe(at(31));
    expect(data.measuredRangeEndExclusive).toBe(at(61));
    expect(data.daysMeasured).toBe(30);
  });

  /*
   * The property the whole thing rests on. If the measured days reached the fit,
   * a violent move inside them would change the volatility the band was drawn
   * from — so the same fit against two wildly different futures must give the
   * same band.
   */
  it("draws the same band whatever the days it is tested against did", () => {
    const calm = calculateOutOfSampleCheck({ history: historyOf(61, wobbling), parameters });
    const violent = calculateOutOfSampleCheck({
      history: historyOf(61, (index) => (index < 31 ? wobbling(index) : wobbling(index) * 40)),
      parameters,
    });

    const a = newest(calm);
    const b = newest(violent);
    expect(b.annualizedVolatility).toBe(a.annualizedVolatility);
    expect(b.lowerPrice).toBe(a.lowerPrice);
    expect(b.upperPrice).toBe(a.upperPrice);
    expect(b.originPrice).toBe(a.originPrice);
    // Only the verdict differs, which is the point.
    expect(a.occupancy.fullyOutside).toBe(0);
    expect(b.occupancy.fullyOutside).toBe(30);
  });

  it("centres the band on the last close the fit could see", () => {
    const data = newest(
      calculateOutOfSampleCheck({ history: historyOf(61, wobbling), parameters }),
    );

    expect(data.originTimestamp).toBe(at(30));
    expect(data.originPrice).toBe(wobbling(30));
    expect(data.lowerPrice).toBeLessThanOrEqual(data.originPrice);
    expect(data.upperPrice).toBeGreaterThanOrEqual(data.originPrice);
  });

  /*
   * A source that never indexed the origin day leaves the most recent close
   * before it — still what someone standing there would have had in front of
   * them, and never a price from the window being tested.
   */
  it("falls back to the last indexed close when the origin day is missing", () => {
    const days = Array.from({ length: 61 }, (_unused, index) => index).filter(
      (index) => index !== 30,
    );
    const data = newest(
      calculateOutOfSampleCheck({
        history: historyOf(61, wobbling, () => ({}), days),
        parameters,
      }),
    );

    expect(data.originTimestamp).toBe(at(29));
    expect(data.originPrice).toBe(wobbling(29));
  });

  it("counts the measured days into the three buckets", () => {
    const data = newest(
      calculateOutOfSampleCheck({ history: historyOf(61, wobbling), parameters }),
    );
    const { fullyInside, fullyOutside, undetermined } = data.occupancy;

    expect(fullyInside + fullyOutside + undetermined).toBe(data.daysMeasured);
  });

  it("leaves a day with unusable extremes undetermined", () => {
    const data = newest(
      calculateOutOfSampleCheck({
        history: historyOf(61, wobbling, (index) =>
          index === 40 ? { low: null, high: null } : {},
        ),
        parameters,
      }),
    );

    expect(data.occupancy.undetermined).toBeGreaterThanOrEqual(1);
  });

  it("reports how many days it actually saw, not how many the horizon has", () => {
    const days = Array.from({ length: 61 }, (_unused, index) => index).filter(
      (index) => index !== 45 && index !== 46,
    );
    const data = newest(
      calculateOutOfSampleCheck({ history: historyOf(61, wobbling, () => ({}), days), parameters }),
    );

    expect(data.daysMeasured).toBe(28);
    expect(data.horizonDays).toBe(30);
  });

  /*
   * Refuses rather than shortens. A 30-day band checked over 20 days is not a
   * check of a 30-day band, and a volatility fitted on 12 closes is not the
   * figure the page would have shown.
   */
  it.each([
    ["a history with no room for the test", 45],
    ["a history exactly one day short", 60],
  ])("refuses %s", (_label, dayCount) => {
    const result = calculateOutOfSampleCheck({ history: historyOf(dayCount, wobbling), parameters });

    expect(result.status).toBe("unavailable");
    expect(result.status === "unavailable" && result.notice).toBe(
      "out-of-sample-insufficient-history",
    );
  });

  it("accepts a history exactly long enough", () => {
    expect(
      calculateOutOfSampleCheck({ history: historyOf(61, wobbling), parameters }).status,
    ).toBe("success");
  });

  it("refuses when the fit window has too few returns to measure anything", () => {
    const sparse = [0, 1, 40, 41, 42, 43, 44, 45, 46, 47];
    const result = calculateOutOfSampleCheck({
      history: historyOf(61, wobbling, () => ({}), sparse),
      parameters,
    });

    expect(result.status).toBe("unavailable");
  });

  /*
   * A pool whose price never moved has no measured dispersion, and its band is
   * the price itself. That is a real state, not a failure.
   */
  it("collapses the band onto the price when nothing moved", () => {
    const data = newest(
      calculateOutOfSampleCheck({ history: historyOf(61, () => 1_000), parameters }),
    );

    expect(data.annualizedVolatility).toBe(0);
    expect(data.lowerPrice).toBe(1_000);
    expect(data.upperPrice).toBe(1_000);
    // Every day's ±1% extremes straddle a zero-width band.
    expect(data.occupancy.undetermined).toBe(30);
  });

  it.each([
    ["a shorter horizon", { horizonDays: 7, standardDeviationMultiplier: 1 }],
    ["a wider multiplier", { horizonDays: 30, standardDeviationMultiplier: 3 }],
  ])("honours %s the reader chose", (_label, chosen) => {
    const data = newest(
      calculateOutOfSampleCheck({ history: historyOf(61, wobbling), parameters: chosen }),
    );

    expect(data.horizonDays).toBe(chosen.horizonDays);
    expect(data.standardDeviationMultiplier).toBe(chosen.standardDeviationMultiplier);
    expect(
      Date.parse(data.measuredRangeEndExclusive) - Date.parse(data.measuredRangeStart),
    ).toBe(chosen.horizonDays * DAY_MS);
  });

  it("widens the band when the multiplier widens, on the same fit", () => {
    const narrow = newest(
      calculateOutOfSampleCheck({ history: historyOf(61, wobbling), parameters }),
    );
    const wide = newest(
      calculateOutOfSampleCheck({
        history: historyOf(61, wobbling),
        parameters: { horizonDays: 30, standardDeviationMultiplier: 3 },
      }),
    );

    expect(wide.lowerPrice).toBeLessThan(narrow.lowerPrice);
    expect(wide.upperPrice).toBeGreaterThan(narrow.upperPrice);
    expect(wide.annualizedVolatility).toBe(narrow.annualizedVolatility);
  });
});


/*
 * One fold is an anecdote. The window is long enough to lay several end to end,
 * and how many fit is decided by the horizon, not by a setting.
 */
describe("folds", () => {
  const longEnough = (foldCount: number, horizonDays: number) =>
    historyOf(31 + foldCount * horizonDays, wobbling);

  it.each([
    ["three folds of thirty days", 3, 30],
    ["a single fold of ninety", 1, 90],
    ["twelve folds of seven", 12, 7],
  ])("fits %s into a history sized for them", (_label, foldCount, horizonDays) => {
    const data = succeeded(
      calculateOutOfSampleCheck({
        history: longEnough(foldCount, horizonDays),
        parameters: { horizonDays, standardDeviationMultiplier: 1 },
      }),
    );

    expect(data.folds).toHaveLength(foldCount);
  });

  it("stops at the first step the history cannot support, rather than shortening one", () => {
    // Room for two folds and most of a third fit, which is not a third fold.
    const data = succeeded(
      calculateOutOfSampleCheck({
        history: historyOf(31 + 2 * 30 + 20, wobbling),
        parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
      }),
    );

    expect(data.folds).toHaveLength(2);
  });

  /*
   * The property that makes the total mean anything: every day between the
   * oldest fold's start and the newest fold's end is counted exactly once.
   */
  it("tiles the history oldest first, with no gap and no overlap", () => {
    const data = succeeded(
      calculateOutOfSampleCheck({
        history: longEnough(3, 30),
        parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
      }),
    );

    data.folds.forEach((fold, index) => {
      const previous = data.folds[index - 1];
      if (previous === undefined) return;
      expect(previous.measuredRangeEndExclusive).toBe(fold.measuredRangeStart);
    });
    expect(data.folds.at(-1)?.measuredRangeEndExclusive).toBe(
      longEnough(3, 30).rangeEndExclusive,
    );
  });

  it("totals exactly what the folds hold", () => {
    const data = succeeded(
      calculateOutOfSampleCheck({
        history: longEnough(3, 30),
        parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
      }),
    );

    const summed = data.folds.reduce((running, fold) => running + fold.daysMeasured, 0);
    expect(data.daysMeasured).toBe(summed);
    expect(data.daysMeasured).toBe(90);
    expect(
      data.occupancy.fullyInside + data.occupancy.fullyOutside + data.occupancy.undetermined,
    ).toBe(90);
  });

  /*
   * Each fold is fitted on its own window, so a pool that behaved differently in
   * one stretch produces a different band there — which is the only reason more
   * than one fold is worth having.
   */
  it("fits each fold on its own window", () => {
    const data = succeeded(
      calculateOutOfSampleCheck({
        history: historyOf(121, (index) => (index < 60 ? 1_000 : wobbling(index))),
        parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
      }),
    );

    const volatilities = data.folds.map((fold) => fold.annualizedVolatility);
    expect(new Set(volatilities).size).toBeGreaterThan(1);
    expect(volatilities[0]).toBe(0);
  });

  it("carries the reader's settings onto every fold", () => {
    const data = succeeded(
      calculateOutOfSampleCheck({
        history: longEnough(3, 30),
        parameters: { horizonDays: 30, standardDeviationMultiplier: 2 },
      }),
    );

    expect(data.folds.every((fold) => fold.horizonDays === 30)).toBe(true);
    expect(data.folds.every((fold) => fold.standardDeviationMultiplier === 2)).toBe(true);
  });
});
