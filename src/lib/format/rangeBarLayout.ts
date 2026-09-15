/*
 * Where to draw a range, a current price and nothing else on one horizontal bar.
 *
 * Laid out in log space, because that is the space the band was drawn in and
 * the space price moves in: a bar that put halving and doubling at different
 * distances from the centre would draw the band as lopsided when it is not.
 *
 * Positions rather than pixels, so the same layout serves any width, and a
 * fixed padding either side so the edges of the range are never the edges of
 * the bar. The current price is inside the padded span whatever it is: a range
 * that does not contain it is drawn with the price outside, which is the one
 * picture worth drawing in that case.
 */

export type RangeBarInput = {
  readonly lower: number;
  readonly upper: number;
  readonly current: number;
};

/** Percent positions along the bar, from 0 at the left to 100 at the right. */
export type RangeBarLayout = {
  readonly lower: number;
  readonly upper: number;
  readonly current: number;
};

/** Space either side of the range, as a share of the range's own log width. */
export const RANGE_BAR_PADDING = 0.15;

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * `null` when there is nothing to draw: a price that is not a price, or a
 * range with no width. A bar drawn from those would be a picture of a bug.
 */
export const layoutRangeBar = ({ lower, upper, current }: RangeBarInput): RangeBarLayout | null => {
  if (!isPositiveFinite(lower) || !isPositiveFinite(upper) || !isPositiveFinite(current)) {
    return null;
  }
  if (lower >= upper) return null;

  const lowerLog = Math.log(lower);
  const upperLog = Math.log(upper);
  const currentLog = Math.log(current);
  const padding = RANGE_BAR_PADDING * (upperLog - lowerLog);

  const start = Math.min(lowerLog, currentLog) - padding;
  const end = Math.max(upperLog, currentLog) + padding;
  const at = (value: number): number => ((value - start) / (end - start)) * 100;

  return { lower: at(lowerLog), upper: at(upperLog), current: at(currentLog) };
};
