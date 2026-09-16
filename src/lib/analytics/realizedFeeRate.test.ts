import { describe, expect, it } from "vitest";

import { type HistoricalPricePoint, RealizedFeeRateSchema } from "../../schemas";
import { calculateRealizedFeeRate, type RealizedFeeRateResult } from "./realizedFeeRate";

const DAY_MS = 86_400_000;
const START = Date.parse("2026-08-15T00:00:00.000Z");

/**
 * One day, described by what it traded and what it charged — the only two fields
 * this calculator reads. The price fields are filled in so the fixture is a real
 * point rather than a cast of a partial one.
 */
const day = (
  index: number,
  volumeUsd: number | null,
  feesUsd: number | null,
): HistoricalPricePoint => ({
  timestamp: new Date(START + index * DAY_MS).toISOString(),
  price: 100,
  low: 99,
  high: 101,
  volumeUsd,
  feesUsd,
});

/** A day charging exactly `ppm` on a million dollars of volume. */
const atRate = (index: number, ppm: number): HistoricalPricePoint =>
  day(index, 1_000_000, ppm);

const measured = (result: RealizedFeeRateResult) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.notice}`);
  return result;
};

/** A stated fee that is one figure: the protocol's cut the same in both directions. */
const statedAt = (ppm: number) => ({ lowestPpm: ppm, highestPpm: ppm });

const rateOf = (points: readonly HistoricalPricePoint[], statedPpm: number | null = null) =>
  measured(
    calculateRealizedFeeRate({ points, stated: statedPpm === null ? null : statedAt(statedPpm) }),
  );

describe("calculateRealizedFeeRate", () => {
  it("divides the rate out of a day's fees and volume", () => {
    const { rate } = rateOf([day(0, 2_000_000, 500)]);

    expect(rate.lowestPpm).toBeCloseTo(250, 12);
    expect(rate.highestPpm).toBeCloseTo(250, 12);
    expect(rate.aggregatePpm).toBeCloseTo(250, 12);
    expect(rate.daysMeasured).toBe(1);
  });

  it("reports the spread across days that charged differently", () => {
    const { rate } = rateOf([atRate(0, 25), atRate(1, 230), atRate(2, 100)]);

    expect(rate.lowestPpm).toBeCloseTo(25, 9);
    expect(rate.highestPpm).toBeCloseTo(230, 9);
    expect(rate.medianPpm).toBeCloseTo(100, 9);
  });

  it("averages the two middle days when the count is even", () => {
    const { rate } = rateOf([atRate(0, 10), atRate(1, 20), atRate(2, 30), atRate(3, 40)]);

    expect(rate.medianPpm).toBeCloseTo(25, 9);
  });

  /*
   * The aggregate is what the month's swappers paid over what they swapped, so a
   * day that traded a hundred times as much has a hundred times the say. The
   * mean of the daily rates would be 300; the weighted answer is 30.
   */
  it("weights the aggregate rate by volume rather than by day", () => {
    const busyCheapDay = day(0, 1_000_000, 10);
    const quietExpensiveDay = day(1, 1_000, 590);

    const { rate } = rateOf([busyCheapDay, quietExpensiveDay]);

    expect(rate.aggregatePpm).toBeCloseTo(600_000 / 1_001_000 * 1_000, 6);
    expect(rate.aggregatePpm).toBeLessThan(600);
  });

  /*
   * Nobody swapped, so nobody paid: `0 / 0` is the absence of a measurement, not
   * a rate of zero. Counting it would drag the spread to zero and report a pool
   * that charges nothing.
   */
  it("excludes a day that traded nothing rather than calling it free", () => {
    const { rate } = rateOf([atRate(0, 250), day(1, 0, 0)]);

    expect(rate.daysMeasured).toBe(1);
    expect(rate.daysUnmeasurable).toBe(1);
    expect(rate.lowestPpm).toBeCloseTo(250, 9);
  });

  it("excludes a day whose volume the source did not report", () => {
    const { rate } = rateOf([atRate(0, 250), day(1, null, 40)]);

    expect(rate.daysMeasured).toBe(1);
    expect(rate.daysUnmeasurable).toBe(1);
  });

  it("excludes a day whose fees the source did not report", () => {
    const { rate } = rateOf([atRate(0, 250), day(1, 1_000_000, null)]);

    expect(rate.daysMeasured).toBe(1);
    expect(rate.daysUnmeasurable).toBe(1);
  });

  /*
   * An excluded day must leave the aggregate alone entirely. Adding its volume
   * to the denominator while adding none of its fees to the numerator reports
   * the pool as cheaper than it was.
   */
  it("keeps an unreported day's volume out of the aggregate too", () => {
    const { rate } = rateOf([atRate(0, 250), day(1, 9_000_000, null)]);

    expect(rate.aggregatePpm).toBeCloseTo(250, 9);
  });

  it("says nothing rather than zero when no day can be measured", () => {
    const result = calculateRealizedFeeRate({ points: [day(0, 0, 0)], stated: statedAt(500) });

    expect(result.status).toBe("unavailable");
    expect(result.status === "unavailable" && result.notice).toBe("fee-rate-unmeasurable");
  });

  it("says nothing when there are no days at all", () => {
    expect(calculateRealizedFeeRate({ points: [], stated: statedAt(500) }).status).toBe("unavailable");
  });

  describe("against the rate the pool declares", () => {
    it("confirms a pool that charged exactly what it says", () => {
      const { verdict } = rateOf([atRate(0, 500), atRate(1, 500)], 500);

      expect(verdict).toEqual({ kind: "matches", stated: statedAt(500) });
    });

    /*
     * The source divides to publish `feesUSD` and this module multiplies back,
     * so a pool whose fee nothing can rewrite still lands an ulp or so away. The
     * measured noise floor across 1517 such pool-days was 2.8e-16 relative; the
     * bound is 1e-9, and a day inside it must read as agreement.
     */
    it("treats float64 rounding as agreement, not disagreement", () => {
      const almost = day(0, 3_333_333, 3_333_333 * 500 / 1_000_000);

      expect(rateOf([almost], 500).verdict.kind).toBe("matches");
    });

    it("counts the days that departed from the declared rate", () => {
      const { verdict } = rateOf([atRate(0, 500), atRate(1, 25), atRate(2, 230)], 500);

      expect(verdict).toEqual({ kind: "differs", stated: statedAt(500), daysDiffering: 2 });
    });

    /*
     * The smallest real disagreement found in live data was a hooked pool
     * charging 92% of its declared tier. Eight parts in a hundred is seven
     * orders of magnitude above the tolerance, so nothing sits near the edge.
     */
    it("calls a rate eight percent below the declared one a disagreement", () => {
      const { verdict } = rateOf([atRate(0, 460)], 500);

      expect(verdict.kind).toBe("differs");
    });

    /*
     * A v4 dynamic-fee pool declares no rate at all: its PoolKey carries a
     * sentinel where the fee would be. There is nothing to agree or disagree
     * with, and the measurement is the only rate there is.
     */
    it("reports no comparison when the pool declares no rate", () => {
      expect(rateOf([atRate(0, 700)], null).verdict).toEqual({ kind: "none-stated" });
    });

    /*
     * v4 permits a zero fee, and a relative tolerance has no magnitude to scale
     * by there — so the comparison falls back to an absolute one rather than
     * dividing by zero or accepting everything.
     */
    it("compares against a declared rate of zero without scaling by it", () => {
      expect(rateOf([day(0, 1_000_000, 0)], 0).verdict.kind).toBe("matches");
      expect(rateOf([atRate(0, 1)], 0).verdict.kind).toBe("differs");
    });
  });
});

/*
 * The case a contrived fixture cannot reach, and every v3 pool does.
 *
 * When a pool charges the same rate every day, the daily quotients land within
 * an ulp of each other and the aggregate — a different division, over the sums —
 * can land an ulp outside their range. The numbers below are the live 30 days of
 * Uniswap v3's busiest pool, USDC/WETH at 5 bps, which produced exactly that and
 * took the whole panel off the page until the bracketing check was given the
 * project's usual relative tolerance.
 */
describe("a pool charging one rate every day", () => {
  /*
   * Two days is enough, and these two are a searched minimum rather than a
   * guess: each divides to exactly 500 ppm, and the aggregate — summed and then
   * divided once — lands at 499.99999999999989, one ulp below both of them.
   *
   * A fixture built from round numbers does not reproduce it, which is why the
   * first version of this test passed without the fix in place.
   */
  const identicalRateDays = [601_791_335, 354_265_643].map((volumeUsd, index) =>
    day(index, volumeUsd, (volumeUsd * 500) / 1_000_000),
  );

  it("is measured rather than refused", () => {
    const { rate, verdict } = rateOf(identicalRateDays, 500);

    expect(rate.daysMeasured).toBe(2);
    expect(rate.lowestPpm).toBe(500);
    expect(rate.highestPpm).toBe(500);
    // The ulp that took the whole panel off the page.
    expect(rate.aggregatePpm).toBeLessThan(500);
    expect(verdict.kind).toBe("matches");
  });

  /*
   * The tolerance absorbs rounding and nothing wider. An aggregate genuinely
   * outside the daily range means the sums came from different columns than the
   * rates, and that must still be refused.
   */
  it("still refuses an aggregate that is genuinely outside the daily range", () => {
    expect(
      RealizedFeeRateSchema.safeParse({
        daysMeasured: 2,
        daysUnmeasurable: 0,
        lowestPpm: 100,
        highestPpm: 200,
        medianPpm: 150,
        aggregatePpm: 260,
      }).success,
    ).toBe(false);
  });
});
