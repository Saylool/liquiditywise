import type { OutOfSampleCheck, RangeOccupancy, TickRange } from "../../schemas";
import { calculateOutOfSampleCheck } from "../analytics/outOfSampleCheck";
import { ACTIVITY_WINDOW_DAYS } from "../analytics/poolActivity";
import { relativeFeeShare } from "../analytics/rangeConcentration";
import { countOccupancy } from "../analytics/rangeOccupancy";
import { calculateTickRange } from "../analytics/tickRange";
import { calculateVolatilityPriceBand } from "../analytics/volatilityPriceBand";
import type { PoolRangeAnalysis } from "./poolRangeAnalysis";
import { MULTIPLIER_CHOICES } from "./requestedParameters";

/*
 * The same method at every width the form offers, side by side.
 *
 * The page shows one range and a form that changes it, and a reader who wants
 * to know what a wider range would have meant has to submit the form once per
 * width and hold four pages in their head. This runs the pipeline's own
 * calculators — the band, the tick grid, the day count, the check on unseen
 * days — once per width, so the trade-off is on one page: a wider range holds
 * more of the days and spreads the same deposit over more prices.
 *
 * Pure, and no cheaper to fake: every figure here is what the page would show
 * if that width were chosen, because it is computed the same way. Nothing here
 * recommends a width; the panel says so.
 *
 * The one figure that is not the page's own is the fee share, which has no
 * single-width meaning at all: it exists only as a comparison, so it is
 * measured against the width being shown. See `rangeConcentration.ts`.
 */

export type WidthComparison = {
  readonly standardDeviationMultiplier: number;
  /** The width the page's own range was drawn with. */
  readonly chosen: boolean;
  readonly range: TickRange;
  /** How the last `daysMeasured` days sat against this width's range: the fit, not a test. */
  readonly occupancy: RangeOccupancy;
  readonly daysMeasured: number;
  /** The page's own check on unseen days, run for this width; `null` where the history had no room. */
  readonly outOfSample: OutOfSampleCheck | null;
  /**
   * What the same deposit would take of the fees charged on a day inside this
   * range, against the width the page is showing — which is therefore always
   * `1`. `null` where either range cannot be valued at the current price.
   */
  readonly relativeFeeShare: number | null;
};

/**
 * The widths to compare: every offered one, and the chosen one if it was typed
 * into the URL rather than offered — ascending, each once.
 */
export const comparedWidths = (chosen: number): readonly number[] =>
  [...new Set<number>([...MULTIPLIER_CHOICES, chosen])].sort((a, b) => a - b);

/**
 * Every width's range, day count and check, at the horizon the page uses.
 *
 * A width the calculators refuse — a band too narrow for the pool's tick grid,
 * say — is left out rather than shown blank; the chosen width is never refused,
 * because the page's own range came through the same calculators. The chosen
 * row recomputes rather than copies the page's figures, and reproduces them
 * exactly, which its test pins.
 */
export const compareWidths = (analysis: PoolRangeAnalysis): readonly WidthComparison[] => {
  const { pool, snapshot, history, volatility, band, parameters } = analysis;
  const recent = history.points.slice(-ACTIVITY_WINDOW_DAYS);
  const rows: Omit<WidthComparison, "relativeFeeShare">[] = [];

  for (const standardDeviationMultiplier of comparedWidths(parameters.standardDeviationMultiplier)) {
    const width = { horizonDays: parameters.horizonDays, standardDeviationMultiplier };

    const band = calculateVolatilityPriceBand({ snapshot, volatility, ...width });
    if (band.status === "unavailable") continue;
    const range = calculateTickRange({ pool, band: band.data, snapshot });
    if (range.status === "unavailable") continue;

    const { occupancy } = countOccupancy(recent, range.data.lowerPrice, range.data.upperPrice);
    const outOfSample = calculateOutOfSampleCheck({ history, parameters: width });

    rows.push({
      standardDeviationMultiplier,
      chosen: standardDeviationMultiplier === parameters.standardDeviationMultiplier,
      range: range.data,
      occupancy,
      daysMeasured: recent.length,
      outOfSample: outOfSample.status === "success" ? outOfSample.data : null,
    });
  }

  /*
   * The fee share last, because it is the only figure here that is a
   * comparison rather than a reading: every row is measured against the row
   * the page is showing, so that row reads as one and the others as what
   * changing to them would do.
   */
  const shown = rows.find((row) => row.chosen)?.range ?? null;

  return rows.map((row) => ({
    ...row,
    relativeFeeShare:
      shown === null ? null : relativeFeeShare(row.range, shown, band.currentPrice),
  }));
};
