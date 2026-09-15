import type {
  DataFailureNotice,
  HistoricalPricePoint,
  PoolActivity,
  PoolDailyPriceHistory,
  TickRange,
} from "../../schemas";
import { PoolActivitySchema } from "../../schemas";
import { countOccupancy } from "./rangeOccupancy";

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

/**
 * The window everything here describes: the last 30 completed UTC days.
 *
 * Exported because the realized fee rate is measured over the same days. The two
 * are read together — the rate is what produced the fees below it — and two
 * copies of "thirty" would eventually become a spread of one span sitting beside
 * a total of another, with nothing on the page to show which.
 */
export const ACTIVITY_WINDOW_DAYS = 30;

/** The days the rolling sums cover, named rather than repeated as literals. */
const ROLLING_WINDOWS = { day: 1, week: 7, month: ACTIVITY_WINDOW_DAYS } as const;

export type PoolActivityResult =
  | { readonly status: "success"; readonly data: PoolActivity }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type PoolActivityInput = {
  readonly history: PoolDailyPriceHistory;
  readonly range: TickRange;
};

export const calculatePoolActivity = ({
  history,
  range,
}: PoolActivityInput): PoolActivityResult => {
  /*
   * One window for everything here: the last 30 completed days.
   *
   * The history carries 31 closes, because 31 closes are what 30 daily returns
   * need — but the extra day is an input to the volatility figure, not a day
   * this describes. Counting occupancy over 31 days while summing fees over 30
   * put the two figures on different sets, and a range wide enough to contain
   * every day then reported more fees charged inside it than the pool charged at
   * all. The schema refused to publish that, which is the right failure and was
   * still a page nobody could read.
   */
  const measured = history.points.slice(-ROLLING_WINDOWS.month);
  if (measured.length === 0) return { status: "unavailable", notice: "activity-unverifiable" };

  const { occupancy, placements } = countOccupancy(
    measured,
    range.lowerPrice,
    range.upperPrice,
  );

  /*
   * Only the days that sat entirely inside. A straddling day charged some of its
   * fees while the range was active and some while it was not, and there is no
   * way to say how much from a daily high and low — so it is left out rather
   * than apportioned by a guess.
   */
  const insideFees = measured.filter((_point, index) => placements[index] === "inside");
  const feesWhileFullyInsideUsd = insideFees.some((point) => point.feesUsd === null)
    ? null
    : insideFees.reduce((total, point) => total + (point.feesUsd ?? 0), 0);

  const candidate = {
    daysMeasured: measured.length,
    volume24hUsd: sumOverLastDays(measured, ROLLING_WINDOWS.day, (point) => point.volumeUsd),
    volume7dUsd: sumOverLastDays(measured, ROLLING_WINDOWS.week, (point) => point.volumeUsd),
    volume30dUsd: sumOverLastDays(measured, ROLLING_WINDOWS.month, (point) => point.volumeUsd),
    fees30dUsd: sumOverLastDays(measured, ROLLING_WINDOWS.month, (point) => point.feesUsd),
    occupancy,
    feesWhileFullyInsideUsd,
  };

  const verified = PoolActivitySchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: "activity-unverifiable" };

  return { status: "success", data: verified.data };
};
