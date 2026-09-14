import { z } from "zod";

import { UsdAmountSchema } from "./primitives";

/*
 * What the pool actually did over the measured window, and how those days sit
 * against the suggested range.
 *
 * Every figure here is a fact about the pool: money that moved, fees the pool
 * charged, days that happened. None of it is a forecast and none of it is an
 * estimate.
 *
 * **None of it is what a position would earn, either.** That would be this
 * pool's fees multiplied by the share of the liquidity active in the range while
 * the swaps happened — which needs the tick-level liquidity distribution this
 * application does not read, and a deposit size it will not invent. The
 * interface says so beside the figures, because the gap between "the pool
 * collected this" and "you would have earned this" is exactly where a reader is
 * most likely to fill in a number nobody gave them.
 */

/**
 * How a day's price range sat against the suggested one.
 *
 * Three buckets rather than a single percentage, because a day is not always
 * resolvable: the source publishes a daily high and low, so a day that spent
 * part of itself inside and part outside cannot be split without intraday data
 * this application does not fetch. Reporting it as a fraction would put a
 * precision on the answer that the measurement does not have.
 */
export const RangeOccupancySchema = z
  .strictObject({
    /** Days whose whole high-low range sat inside the suggested range. */
    fullyInside: z.int().min(0),
    /** Days whose whole range sat outside it. */
    fullyOutside: z.int().min(0),
    /**
     * Days that straddled an edge, and days whose extremes could not be used.
     * Both mean the same thing here: this cannot say where the day was spent.
     */
    undetermined: z.int().min(0),
  })
  .refine(
    (occupancy) =>
      occupancy.fullyInside + occupancy.fullyOutside + occupancy.undetermined > 0,
    { error: "An occupancy with no days in it describes nothing." },
  );

export type RangeOccupancy = z.infer<typeof RangeOccupancySchema>;

export const PoolActivitySchema = z
  .strictObject({
    /**
     * Days the window actually contained. The buckets below add up to this, and
     * the rolling sums are null unless the window held enough days to fill them.
     */
    daysMeasured: z.int().min(1),

    /**
     * What the pool traded over the last day, week and month of the window.
     *
     * Null rather than a smaller sum when the window is too short or a day's
     * figure is missing: a seven-day total built from four days is not a
     * seven-day total, and publishing it as one would understate activity
     * without saying so.
     */
    volume24hUsd: UsdAmountSchema.nullable(),
    volume7dUsd: UsdAmountSchema.nullable(),
    volume30dUsd: UsdAmountSchema.nullable(),

    /** What the pool charged in swap fees over the same month. Not what an LP got. */
    fees30dUsd: UsdAmountSchema.nullable(),

    occupancy: RangeOccupancySchema,

    /**
     * Fees the pool charged on the days that sat entirely inside the range.
     *
     * The closest honest answer to "would this range have been earning", and
     * still not an amount anyone would have received — it is the whole pool's,
     * shared among everyone whose liquidity was active.
     */
    feesWhileFullyInsideUsd: UsdAmountSchema.nullable(),
  })
  .refine(
    ({ daysMeasured, occupancy }) =>
      occupancy.fullyInside + occupancy.fullyOutside + occupancy.undetermined === daysMeasured,
    {
      error: "Every measured day must land in exactly one bucket.",
      path: ["occupancy"],
    },
  )
  .refine(
    ({ fees30dUsd, feesWhileFullyInsideUsd }) =>
      fees30dUsd === null ||
      feesWhileFullyInsideUsd === null ||
      feesWhileFullyInsideUsd <= fees30dUsd,
    {
      error: "Fees charged on a subset of days cannot exceed the fees charged on all of them.",
      path: ["feesWhileFullyInsideUsd"],
    },
  );

export type PoolActivity = z.infer<typeof PoolActivitySchema>;
