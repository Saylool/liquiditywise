import type { HistoricalPricePoint, RangeOccupancy } from "../../schemas";

/*
 * Where a day's trading sat against a price range, and how a run of days splits.
 *
 * Shared, because two different questions are answered by the same counting and
 * they must be counted the same way: how the pool's recent days sit against the
 * range being suggested, and how the days that followed a past band sat against
 * that one. A second copy of this would let the honest check and the in-sample
 * description disagree about what "inside" means.
 *
 * Pure: no clock, no network, no environment.
 */

/** A day's price range against a price range, when it can be placed at all. */
export type Placement = "inside" | "outside" | "undetermined";

/**
 * Places one day.
 *
 * A daily high and low cannot say *where inside the day* the price was, so a day
 * that crossed an edge is left unplaced rather than apportioned by a guess. The
 * bounds are inclusive, as a position's are.
 */
export const placeDay = (
  point: HistoricalPricePoint,
  lowerPrice: number,
  upperPrice: number,
): Placement => {
  // Extremes are dropped upstream when a day's own price fell outside them, so
  // their absence means the day cannot be placed rather than that it was quiet.
  if (point.low === null || point.high === null) return "undetermined";
  if (point.low >= lowerPrice && point.high <= upperPrice) return "inside";
  if (point.high < lowerPrice || point.low > upperPrice) return "outside";

  return "undetermined";
};

/**
 * Places every day and counts the three buckets.
 *
 * Three buckets rather than a single percentage, because a day is not always
 * resolvable and a fraction would put a precision on the answer that the
 * measurement does not have.
 */
export const countOccupancy = (
  points: readonly HistoricalPricePoint[],
  lowerPrice: number,
  upperPrice: number,
): { readonly occupancy: RangeOccupancy; readonly placements: readonly Placement[] } => {
  const placements = points.map((point) => placeDay(point, lowerPrice, upperPrice));

  return {
    placements,
    occupancy: {
      fullyInside: placements.filter((placement) => placement === "inside").length,
      fullyOutside: placements.filter((placement) => placement === "outside").length,
      undetermined: placements.filter((placement) => placement === "undetermined").length,
    },
  };
};
