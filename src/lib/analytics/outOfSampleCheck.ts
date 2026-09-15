import {
  type DataFailureNotice,
  type OutOfSampleCheck,
  OutOfSampleCheckSchema,
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
 * Steps the whole method back in time by one horizon and checks what happened.
 *
 * Pure: no clock, no network, no environment. Every day it reads was already
 * fetched for the volatility figure, so it costs no extra request — the history
 * reader asks for a long span precisely so this can be done from one reading.
 *
 * The shape of it:
 *
 *   |<-- fit: 31 closes -->|<-- measured: one horizon -->|
 *                          ^ origin: the band is centred here
 *
 * Nothing on the right of the origin reaches the fit. That is the entire point,
 * and the domain schema checks it rather than trusting this function to have got
 * the two slices the right way round.
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
 * Fits a band where the reader's band would have been fitted one horizon ago,
 * and counts how the days since sat against it.
 *
 * Refuses rather than shortens. `takeDaysEnding` clamps a window that reaches
 * past the start of the history, so both windows are checked for full length: a
 * 30-day band checked over 20 days is not a check of a 30-day band, and a
 * volatility fitted on 12 closes is not the figure the page would have shown.
 */
export const calculateOutOfSampleCheck = ({
  history,
  parameters,
}: OutOfSampleCheckInput): OutOfSampleCheckResult => {
  const { horizonDays, standardDeviationMultiplier } = parameters;

  const measured = takeDaysEnding(history, history.rangeEndExclusive, horizonDays);
  if (measured === null) return unavailable(INSUFFICIENT);

  /*
   * Only the fit window's length is checked, and that is not an oversight.
   *
   * `takeDaysEnding` clamps rather than refuses, so a measured window can come
   * back shorter than the horizon — but only when the horizon is longer than the
   * whole history, and then the measured window starts at the history's own
   * start, which leaves the fit window with nowhere to go and makes it null. A
   * short measurement therefore cannot reach this line, and mutation testing
   * confirmed it: removing a length check here changed nothing any test could
   * see. The schema still requires the measurement to span the whole horizon, so
   * the property is guaranteed at the boundary rather than guessed at here.
   */
  const fitted = takeDaysEnding(history, measured.rangeStart, VOLATILITY_WINDOW_DAYS);
  if (fitted === null || spanInDays(fitted) !== VOLATILITY_WINDOW_DAYS) {
    return unavailable(INSUFFICIENT);
  }

  /*
   * The same calculator the page's own figure comes from, given a different
   * window. A separate implementation here would be free to disagree with the
   * number the reader is looking at.
   */
  const volatility = calculateHistoricalVolatility(fitted);
  if (volatility.status === "unavailable") return unavailable(INSUFFICIENT);

  // The last close the fit could see. Not the current price, which is the whole
  // difference between this and the figures above it.
  const origin = fitted.points.at(-1);
  if (origin === undefined) return unavailable(INSUFFICIENT);

  const band = projectLogSymmetricBand({
    price: origin.price,
    annualizedVolatility: volatility.data.annualizedVolatility,
    horizonDays,
    standardDeviationMultiplier,
  });
  if (band === null) return unavailable(UNVERIFIABLE);

  if (measured.points.length === 0) return unavailable(INSUFFICIENT);
  const { occupancy } = countOccupancy(measured.points, band.lowerPrice, band.upperPrice);

  const candidate = {
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

  const verified = OutOfSampleCheckSchema.safeParse(candidate);
  if (!verified.success) return unavailable(UNVERIFIABLE);

  return { status: "success", data: verified.data };
};
