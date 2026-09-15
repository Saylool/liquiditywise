import {
  type DataFailureNotice,
  type OutOfSampleCheck,
  OutOfSampleCheckSchema,
  type OutOfSampleFold,
  type PoolDailyPriceHistory,
  type PriceBandParameters,
  VOLATILITY_WINDOW_DAYS,
} from "../../schemas";
import { takeDaysEnding } from "./dailyHistoryWindows";
import { MS_PER_DAY } from "./dailyLogReturns";
import { calculateHistoricalVolatility } from "./historicalVolatility";
import { projectLogSymmetricBand } from "./logSymmetricBand";
import { countOccupancy } from "./rangeOccupancy";

/*
 * Steps the whole method back in time and checks what happened, as many times as
 * the history allows.
 *
 * Pure: no clock, no network, no environment. Every day it reads was already
 * fetched for the volatility figure, so it costs no extra request — the history
 * reader asks for a long span precisely so this can be done from one reading.
 *
 * The shape of one fold:
 *
 *   |<-- fit: 31 closes -->|<-- measured: one horizon -->|
 *                          ^ origin: the band is centred here
 *
 * Nothing on the right of the origin reaches the fit. That is the entire point,
 * and the domain schema checks it rather than trusting this function to have got
 * the two slices the right way round.
 *
 * Folds are then laid end to end going backwards, each one's measured window
 * starting where the previous one's ended, until the history runs out of room
 * for another fit. No day is measured twice and none is skipped.
 */

const INSUFFICIENT = "out-of-sample-insufficient-history";
const UNVERIFIABLE = "out-of-sample-unverifiable";

export type OutOfSampleCheckResult =
  | { readonly status: "success"; readonly data: OutOfSampleCheck }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type OutOfSampleCheckInput = {
  readonly history: PoolDailyPriceHistory;
  /** The same band the reader is being shown, stepped back rather than altered. */
  readonly parameters: PriceBandParameters;
};

const unavailable = (notice: DataFailureNotice): OutOfSampleCheckResult => ({
  status: "unavailable",
  notice,
});

/** How long a window is, in whole days. Both bounds are day-aligned by schema. */
const spanInDays = (window: PoolDailyPriceHistory): number =>
  (Date.parse(window.rangeEndExclusive) - Date.parse(window.rangeStart)) / MS_PER_DAY;

/**
 * One fold: a band fitted immediately before `measuredEndExclusive` minus a
 * horizon, and the days from there to `measuredEndExclusive` counted against it.
 *
 * Returns `null` when the history has no room for another one, which is how the
 * loop below knows to stop. It cannot distinguish "no room" from "the arithmetic
 * failed", and does not need to: a fold that cannot be drawn is not shown either
 * way, and a failure that reaches the roll-up is caught by the schema there.
 */
const foldEnding = (
  history: PoolDailyPriceHistory,
  parameters: PriceBandParameters,
  measuredEndExclusive: string,
): OutOfSampleFold | null => {
  const { horizonDays, standardDeviationMultiplier } = parameters;

  const measured = takeDaysEnding(history, measuredEndExclusive, horizonDays);
  if (measured === null) return null;

  /*
   * Only the fit window's length is checked, and that is not an oversight.
   *
   * `takeDaysEnding` clamps rather than refuses, so a measured window can come
   * back shorter than the horizon — but only when the horizon reaches past the
   * start of the history, and then the measured window starts at the history's
   * own start, which leaves the fit window with nowhere to go and makes it null.
   * A short measurement therefore cannot get past the next check. The schema
   * still requires the measurement to span the whole horizon, so the property is
   * guaranteed at the boundary rather than guessed at twice.
   */
  const fitted = takeDaysEnding(history, measured.rangeStart, VOLATILITY_WINDOW_DAYS);
  if (fitted === null || spanInDays(fitted) !== VOLATILITY_WINDOW_DAYS) return null;

  /*
   * The same calculator the page's own figure comes from, given a different
   * window. A separate implementation here would be free to disagree with the
   * number the reader is looking at.
   */
  const volatility = calculateHistoricalVolatility(fitted);
  if (volatility.status === "unavailable") return null;

  // The last close the fit could see. Not the current price, which is the whole
  // difference between this and the figures above it.
  const origin = fitted.points.at(-1);
  if (origin === undefined) return null;

  const band = projectLogSymmetricBand({
    price: origin.price,
    annualizedVolatility: volatility.data.annualizedVolatility,
    horizonDays,
    standardDeviationMultiplier,
  });
  if (band === null) return null;

  if (measured.points.length === 0) return null;
  const { occupancy } = countOccupancy(measured.points, band.lowerPrice, band.upperPrice);

  return {
    fitRangeStart: fitted.rangeStart,
    fitRangeEndExclusive: fitted.rangeEndExclusive,
    measuredRangeStart: measured.rangeStart,
    measuredRangeEndExclusive: measured.rangeEndExclusive,
    originTimestamp: origin.timestamp,
    originPrice: origin.price,
    lowerPrice: band.lowerPrice,
    upperPrice: band.upperPrice,
    annualizedVolatility: volatility.data.annualizedVolatility,
    horizonDays,
    standardDeviationMultiplier,
    daysMeasured: measured.points.length,
    occupancy,
  };
};

/**
 * Walks the folds back through the history and adds them up.
 *
 * Each fold's measured window ends where the previous one began, so the folds
 * tile the recent history: no day is counted twice and none is skipped. The walk
 * stops at the first step the history cannot support, which is why a short
 * history yields fewer folds rather than shorter ones.
 *
 * Consecutive fits overlap, because a 31-close fit is longer than a step of one
 * horizon for every horizon the interface offers. The folds are therefore not
 * independent of each other, and the interface says so beside the total.
 */
export const calculateOutOfSampleCheck = ({
  history,
  parameters,
}: OutOfSampleCheckInput): OutOfSampleCheckResult => {
  const newestFirst: OutOfSampleFold[] = [];
  let measuredEndExclusive = history.rangeEndExclusive;

  for (;;) {
    const fold = foldEnding(history, parameters, measuredEndExclusive);
    if (fold === null) break;
    newestFirst.push(fold);
    measuredEndExclusive = fold.measuredRangeStart;
  }

  if (newestFirst.length === 0) return unavailable(INSUFFICIENT);

  const folds = [...newestFirst].reverse();
  const totals = folds.reduce(
    (running, fold) => ({
      daysMeasured: running.daysMeasured + fold.daysMeasured,
      fullyInside: running.fullyInside + fold.occupancy.fullyInside,
      fullyOutside: running.fullyOutside + fold.occupancy.fullyOutside,
      undetermined: running.undetermined + fold.occupancy.undetermined,
    }),
    { daysMeasured: 0, fullyInside: 0, fullyOutside: 0, undetermined: 0 },
  );

  const verified = OutOfSampleCheckSchema.safeParse({
    horizonDays: parameters.horizonDays,
    standardDeviationMultiplier: parameters.standardDeviationMultiplier,
    folds,
    daysMeasured: totals.daysMeasured,
    occupancy: {
      fullyInside: totals.fullyInside,
      fullyOutside: totals.fullyOutside,
      undetermined: totals.undetermined,
    },
  });
  if (!verified.success) return unavailable(UNVERIFIABLE);

  return { status: "success", data: verified.data };
};
