import type {
  DataFailureNotice,
  HistoricalPricePoint,
  PoolActivity,
  PoolDailyPriceHistory,
  V3TickRange,
} from "../../schemas";
import { PoolActivitySchema } from "../../schemas";

/*
 * What the pool did over the measured window, and how those days sat against the
 * suggested range.
 *
 * Pure: no clock, no network, no environment. Everything it reads was already
 * fetched for the volatility figure, so this costs no extra request.
 *
 * **The occupancy is in-sample and the interface says so.** The range was drawn
 * from the volatility of these same days, so a band that contains most of them
 * is a description of how it was fitted rather than a test of how it holds up.
 * It is also a counterfactual nobody could have acted on: the range is centred
 * on *today's* price, and nobody could have opened it a month ago. What it
 * honestly says is how the pool's recent movement sits against the range being
 * suggested — which is worth knowing, and is not a backtest.
 */

/** A day's price range against the suggested one, when it can be placed at all. */
type Placement = "inside" | "outside" | "undetermined";

const placeDay = (
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
 * Sums a figure over the last `days` days, or returns `null`.
 *
 * Null when the window is shorter than asked for, and null when any day inside
 * it is missing the figure. A seven-day total assembled from four days is not a
 * seven-day total, and there is no honest way to label one.
 */
const sumOverLastDays = (
  points: readonly HistoricalPricePoint[],
  days: number,
  read: (point: HistoricalPricePoint) => number | null,
): number | null => {
  if (points.length < days) return null;

  let total = 0;
  for (const point of points.slice(-days)) {
    const value = read(point);
    if (value === null) return null;
    total += value;
  }

  return total;
};

export type PoolActivityResult =
  | { readonly status: "success"; readonly data: PoolActivity }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type PoolActivityInput = {
  readonly history: PoolDailyPriceHistory;
  readonly range: V3TickRange;
};

/** The days the rolling sums cover, named rather than repeated as literals. */
const ROLLING_WINDOWS = { day: 1, week: 7, month: 30 } as const;

export const calculatePoolActivity = ({
  history,
  range,
}: PoolActivityInput): PoolActivityResult => {
  const { points } = history;
  if (points.length === 0) return { status: "unavailable", notice: "activity-unverifiable" };

  const placements = points.map((point) =>
    placeDay(point, range.lowerPrice, range.upperPrice),
  );

  const occupancy = {
    fullyInside: placements.filter((placement) => placement === "inside").length,
    fullyOutside: placements.filter((placement) => placement === "outside").length,
    undetermined: placements.filter((placement) => placement === "undetermined").length,
  };

  /*
   * Only the days that sat entirely inside. A straddling day charged some of its
   * fees while the range was active and some while it was not, and there is no
   * way to say how much from a daily high and low — so it is left out rather
   * than apportioned by a guess.
   */
  const insideFees = points.filter((_point, index) => placements[index] === "inside");
  const feesWhileFullyInsideUsd = insideFees.some((point) => point.feesUsd === null)
    ? null
    : insideFees.reduce((total, point) => total + (point.feesUsd ?? 0), 0);

  const candidate = {
    daysMeasured: points.length,
    volume24hUsd: sumOverLastDays(points, ROLLING_WINDOWS.day, (point) => point.volumeUsd),
    volume7dUsd: sumOverLastDays(points, ROLLING_WINDOWS.week, (point) => point.volumeUsd),
    volume30dUsd: sumOverLastDays(points, ROLLING_WINDOWS.month, (point) => point.volumeUsd),
    fees30dUsd: sumOverLastDays(points, ROLLING_WINDOWS.month, (point) => point.feesUsd),
    occupancy,
    feesWhileFullyInsideUsd,
  };

  const verified = PoolActivitySchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: "activity-unverifiable" };

  return { status: "success", data: verified.data };
};
