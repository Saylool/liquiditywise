import {
  type DataFailureNotice,
  DECLARED_FEE_TOLERANCE,
  type HistoricalPricePoint,
  type RealizedFeeRate,
  RealizedFeeRateSchema,
  type StatedFeeVerdict,
  type StatedSwapFee,
} from "../../schemas";

/*
 * Divides the fee rate back out of figures the source already publishes.
 *
 * Pure: no clock, no network, no environment. Every day it reads was fetched for
 * the volatility figure, so it costs no request.
 *
 * The arithmetic is one division, and all of the care is in which days are
 * allowed into it.
 */

const UNMEASURABLE = "fee-rate-unmeasurable";

export type RealizedFeeRateResult =
  | {
      readonly status: "success";
      readonly rate: RealizedFeeRate;
      readonly verdict: StatedFeeVerdict;
    }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type RealizedFeeRateInput = {
  /** The days to measure over. The caller decides the window. */
  readonly points: readonly HistoricalPricePoint[];
  /**
   * What a swap pays by the pool's own terms — the LP fee and the protocol's
   * cut combined as the chain combines them, a range when the cut differs by
   * direction — or `null` when the pool says nothing, which for a v4
   * dynamic-fee pool is the literal truth: the PoolKey carries a sentinel
   * where the fee would be, and the hook decides per swap.
   */
  readonly stated: StatedSwapFee | null;
};

/**
 * The rate one day charged, or `null` when that day cannot answer.
 *
 * A day with no volume is excluded rather than counted as zero. Nobody swapped,
 * so nobody paid anything, and `0 / 0` is not a rate of zero — it is the absence
 * of a measurement. Counting it would drag every spread down to zero and report
 * a free pool.
 *
 * A day missing either figure is excluded for the same reason: the quotient of a
 * known numerator and an unknown denominator is not a number this may publish.
 */
const dailyRatePpm = (point: HistoricalPricePoint): number | null => {
  const { volumeUsd, feesUsd } = point;
  if (volumeUsd === null || feesUsd === null || volumeUsd <= 0) return null;

  return (feesUsd / volumeUsd) * 1_000_000;
};

/**
 * The middle value of an ascending series.
 *
 * Averages the two middle days on an even count, which is the ordinary
 * convention and stays inside the range by construction — the schema checks
 * that, so a sort that silently failed would be caught rather than published.
 */
const median = (ascending: readonly number[]): number => {
  const middle = ascending.length >> 1;
  const upper = ascending[middle] ?? 0;

  return ascending.length % 2 === 1 ? upper : ((ascending[middle - 1] ?? 0) + upper) / 2;
};

/**
 * Relative comparison, so the tolerance means the same thing at 1 ppm and at
 * 10000 ppm. A stated rate of zero — which v4 permits — compares absolutely,
 * since there is no magnitude to scale by. Inside the stated range is a match:
 * the range is one figure wide unless the protocol's cut differs by direction.
 */
const matchesStated = (measuredPpm: number, stated: StatedSwapFee): boolean =>
  measuredPpm >= stated.lowestPpm - DECLARED_FEE_TOLERANCE * Math.max(1, stated.lowestPpm) &&
  measuredPpm <= stated.highestPpm + DECLARED_FEE_TOLERANCE * Math.max(1, stated.highestPpm);

/**
 * Measures what a pool actually charged over the days given, and says whether
 * that is what it claims to charge.
 *
 * Reports absence rather than a rate when no day can answer: a pool that traded
 * nothing all month charged nothing, and "0 ppm" would read as a free pool
 * instead of an idle one.
 */
export const calculateRealizedFeeRate = ({
  points,
  stated,
}: RealizedFeeRateInput): RealizedFeeRateResult => {
  const rates: number[] = [];
  let totalVolumeUsd = 0;
  let totalFeesUsd = 0;
  let daysUnmeasurable = 0;

  for (const point of points) {
    const rate = dailyRatePpm(point);
    if (rate === null) {
      daysUnmeasurable += 1;
      continue;
    }

    rates.push(rate);
    /*
     * Summed only over the days that were measured, so the aggregate covers the
     * same set as the extremes. Including a day whose fees were unreported would
     * add its volume to the denominator and none of its fees to the numerator,
     * which reports the pool as cheaper than it was.
     */
    totalVolumeUsd += point.volumeUsd ?? 0;
    totalFeesUsd += point.feesUsd ?? 0;
  }

  if (rates.length === 0) return { status: "unavailable", notice: UNMEASURABLE };

  const ascending = [...rates].sort((left, right) => left - right);

  const candidate = {
    daysMeasured: rates.length,
    daysUnmeasurable,
    lowestPpm: ascending[0] ?? 0,
    highestPpm: ascending[ascending.length - 1] ?? 0,
    medianPpm: median(ascending),
    /*
     * Divided from the sums rather than averaged from the daily rates. The two
     * differ whenever volume is uneven, and the sums are the honest one: they
     * are what the month's swappers paid over what they swapped.
     */
    aggregatePpm: totalVolumeUsd > 0 ? (totalFeesUsd / totalVolumeUsd) * 1_000_000 : 0,
  };

  const verified = RealizedFeeRateSchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: UNMEASURABLE };

  if (stated === null) {
    return { status: "success", rate: verified.data, verdict: { kind: "none-stated" } };
  }

  const daysDiffering = rates.filter((rate) => !matchesStated(rate, stated)).length;

  return {
    status: "success",
    rate: verified.data,
    verdict:
      daysDiffering === 0
        ? { kind: "matches", stated }
        : { kind: "differs", stated, daysDiffering },
  };
};
