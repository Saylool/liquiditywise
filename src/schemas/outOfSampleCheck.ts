import { z } from "zod";

import { RangeOccupancySchema } from "./poolActivity";
import { MAX_HORIZON_DAYS } from "./priceBand";
import { IsoTimestampSchema, PositivePriceSchema } from "./primitives";

/*
 * The one figure on this page that is not fitted to the days it describes.
 *
 * Everything else measures the pool over a window and then draws a band from
 * that same window, so a band containing most of those days describes how it was
 * fitted rather than testing how it holds. The page has always said so. This is
 * the test it could not previously run.
 *
 * The method is stepped back in time by exactly one horizon: volatility is
 * measured from the days *before* that point, the band is centred on the price
 * *at* that point — a price someone standing there would actually have seen —
 * and it is then compared against the days that followed, which the fit knew
 * nothing about.
 *
 * **It is one fold, and the page says so.** One origin, one horizon, one pool:
 * a single observation of how the method did, not a distribution of how it does.
 * A band that held here may not hold next month, and the honest reading is "this
 * is what would have happened once", not "this works".
 */

/** Two windows that meet at a point, in milliseconds. */
const MS_PER_DAY = 86_400_000;

type CheckShape = {
  readonly fitRangeStart: string;
  readonly fitRangeEndExclusive: string;
  readonly measuredRangeStart: string;
  readonly measuredRangeEndExclusive: string;
  readonly originTimestamp: string;
  readonly originPrice: number;
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly horizonDays: number;
  readonly daysMeasured: number;
  readonly occupancy: { fullyInside: number; fullyOutside: number; undetermined: number };
};

/**
 * The fit must end exactly where the measurement begins.
 *
 * This is the whole claim. A gap between them would quietly discard days, and an
 * overlap would put days the fit saw back into the test — which is the in-sample
 * problem this exists to escape, reappearing in a shape nobody would notice.
 */
const windowsMeet = (check: CheckShape): boolean =>
  check.fitRangeEndExclusive === check.measuredRangeStart;

/**
 * The price the band was centred on has to be a close the fit actually saw.
 *
 * Usually the last day of the fit window; if the source never indexed that day,
 * the most recent one before it — which is still what someone standing at the
 * origin would have had in front of them. What it must never be is a price from
 * the window being tested.
 */
const originIsInsideTheFitWindow = (check: CheckShape): boolean =>
  Date.parse(check.fitRangeStart) <= Date.parse(check.originTimestamp) &&
  Date.parse(check.originTimestamp) < Date.parse(check.fitRangeEndExclusive);

/** A fit window with no days in it measured nothing. */
const fitWindowIsReal = (check: CheckShape): boolean =>
  Date.parse(check.fitRangeStart) < Date.parse(check.fitRangeEndExclusive);

/**
 * The band has to contain the price it was centred on.
 *
 * True by construction — the band is laid symmetrically in logs around exactly
 * this price — which is why it is worth checking: if it ever failed, the origin
 * and the band would have come from different moments.
 */
const bandContainsItsOrigin = (check: CheckShape): boolean =>
  check.lowerPrice <= check.originPrice && check.originPrice <= check.upperPrice;

/**
 * The measurement must span the whole horizon the band was drawn for.
 *
 * A 30-day band checked over 20 days is not a check of a 30-day band, and would
 * flatter it: fewer days is fewer chances to leave the range.
 */
const measurementCoversTheHorizon = (check: CheckShape): boolean =>
  Date.parse(check.measuredRangeEndExclusive) - Date.parse(check.measuredRangeStart) ===
  check.horizonDays * MS_PER_DAY;

/** Every observed day lands in exactly one bucket. */
const everyDayIsCounted = (check: CheckShape): boolean =>
  check.occupancy.fullyInside + check.occupancy.fullyOutside + check.occupancy.undetermined ===
  check.daysMeasured;

/**
 * A window of `horizonDays` days cannot hold more observations than that.
 *
 * It can hold fewer — a day the source never indexed is simply absent, and the
 * interface reports how many days were actually seen rather than assuming the
 * window was full.
 */
const noMoreDaysThanTheHorizon = (check: CheckShape): boolean =>
  check.daysMeasured <= check.horizonDays;

export const OutOfSampleCheckSchema = z
  .strictObject({
    /** The window the volatility was measured from. All of it precedes the test. */
    fitRangeStart: IsoTimestampSchema,
    fitRangeEndExclusive: IsoTimestampSchema,
    /** The days the band was then measured against, which the fit never saw. */
    measuredRangeStart: IsoTimestampSchema,
    measuredRangeEndExclusive: IsoTimestampSchema,

    /** Which day's close the band was centred on. */
    originTimestamp: IsoTimestampSchema,
    /**
     * The last close the fit could see, and what the band was centred on.
     *
     * The point of the whole exercise: a band centred on today's price is one
     * nobody could have opened a month ago, and this one could have been.
     */
    originPrice: PositivePriceSchema,
    lowerPrice: PositivePriceSchema,
    upperPrice: PositivePriceSchema,

    /** What the fit measured — deliberately not the figure shown above it. */
    annualizedVolatility: z.number().min(0),

    horizonDays: z.int().min(1).max(MAX_HORIZON_DAYS),
    standardDeviationMultiplier: z.number().positive(),

    /** Days actually observed in the measured window, gaps excluded. */
    daysMeasured: z.int().min(1),
    occupancy: RangeOccupancySchema,
  })
  .refine(windowsMeet, {
    error: "The fit window must end exactly where the measured window begins.",
    path: ["measuredRangeStart"],
  })
  .refine(originIsInsideTheFitWindow, {
    error: "The band's centre must be a close from inside the fit window.",
    path: ["originTimestamp"],
  })
  .refine(fitWindowIsReal, {
    error: "fitRangeStart must be earlier than fitRangeEndExclusive.",
    path: ["fitRangeStart"],
  })
  .refine(bandContainsItsOrigin, {
    error: "A band must contain the price it was centred on.",
    path: ["originPrice"],
  })
  .refine(measurementCoversTheHorizon, {
    error: "The measured window must span exactly the horizon the band was drawn for.",
    path: ["measuredRangeEndExclusive"],
  })
  .refine(everyDayIsCounted, {
    error: "Every measured day must land in exactly one bucket.",
    path: ["occupancy"],
  })
  .refine(noMoreDaysThanTheHorizon, {
    error: "A horizon cannot hold more observed days than it has days.",
    path: ["daysMeasured"],
  });

export type OutOfSampleCheck = z.infer<typeof OutOfSampleCheckSchema>;
