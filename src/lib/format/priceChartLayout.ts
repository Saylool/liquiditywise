import type { HistoricalPricePoint } from "../../schemas";
import { placeDay, type Placement } from "../analytics/rangeOccupancy";
import { type PriceQuote, quotedInterval, quotedPrice } from "./priceQuote";

/*
 * Where to draw a month of prices against the suggested range.
 *
 * The same three numbers a reader is given as text — two edges and a current
 * price — mean more with the last thirty days drawn through them: whether the
 * range is wider than anything the month did, whether the price has been
 * hugging one edge, whether a day that "crossed an edge" barely touched it or
 * ran straight through. All of it is in figures the page already fetched for
 * the volatility; nothing here costs a request.
 *
 * Vertical positions are pixels on a chart of fixed height, horizontal ones
 * percentages of whatever width the page gives it, so the same layout serves
 * a phone and a desktop and the labels stay legible on both: an SVG with no
 * viewBox does not scale its text down with its width.
 *
 * Log scale, like the bar this replaces and the band it draws: price moves
 * in ratios, and a chart that put halving and doubling at different distances
 * would draw the band as lopsided when it is not.
 */

/** The chart's vertical geometry, in CSS pixels. */
export const PRICE_CHART = { height: 240, top: 16, bottom: 28 } as const;

/** Space above and below everything drawn, as a share of the log span. */
export const PRICE_CHART_PADDING = 0.06;

/** Half the span given to a month whose price never moved, so it is still a chart. */
const FLAT_HALF_SPAN = 0.1;

export type ChartDay = {
  /** The UTC day, as `YYYY-MM-DD`. */
  readonly date: string;
  /** The day's close, in the shown direction. */
  readonly close: number;
  /** The day's extremes, in the shown direction, or `null` when the source did not report them. */
  readonly low: number | null;
  readonly high: number | null;
  /** Where the day sat against the range — counted in the pool's own direction, which is direction-free. */
  readonly placement: Placement;
};

/**
 * The days to draw, out of the history the analysis was measured from.
 *
 * Prices are turned the reader's way round here, and a day's extremes trade
 * places when they are: the reciprocal of the high is the low. The placement
 * is counted before turning, by the same rule the activity figures use, so
 * a filled dot on the chart is exactly a day the sentence beside it counts
 * as inside.
 */
export const chartDays = (
  points: readonly HistoricalPricePoint[],
  quote: PriceQuote,
  range: { readonly lowerPrice: number; readonly upperPrice: number },
): readonly ChartDay[] =>
  points.map((point) => {
    const extremes =
      point.low === null || point.high === null
        ? null
        : quotedInterval(quote, { lower: point.low, upper: point.high });

    return {
      date: point.timestamp.slice(0, 10),
      close: quotedPrice(quote, point.price),
      low: extremes === null ? null : extremes.lower,
      high: extremes === null ? null : extremes.upper,
      placement: placeDay(point, range.lowerPrice, range.upperPrice),
    };
  });

export type PriceChartInput = {
  readonly days: readonly ChartDay[];
  /**
   * The range's edges in the shown direction, or `null` for an edge the pool
   * could not express — the band then runs off the chart in that direction,
   * which is what a truncated edge means.
   */
  readonly lower: number | null;
  readonly upper: number | null;
  readonly current: number;
};

export type ChartPoint = {
  /** Percent of the chart's width. */
  readonly x: number;
  /** Pixels from the top: the close, and the day's extremes when it has them. */
  readonly y: number;
  readonly yLow: number | null;
  readonly yHigh: number | null;
  readonly placement: Placement;
  readonly date: string;
};

export type PriceChartLayout = {
  readonly points: readonly ChartPoint[];
  readonly plotTop: number;
  readonly plotBottom: number;
  /** The band's top and bottom in pixels; an open edge sits at the plot's own edge. */
  readonly bandTop: number;
  readonly bandBottom: number;
  /** The edge lines, or `null` where the edge is open. */
  readonly upperY: number | null;
  readonly lowerY: number | null;
  readonly currentY: number;
};

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * `null` when there is nothing to draw, or something that is not a price
 * among what was given. A chart drawn from that would be a picture of a bug.
 */
export const layoutPriceChart = ({
  days,
  lower,
  upper,
  current,
}: PriceChartInput): PriceChartLayout | null => {
  if (days.length === 0 || !isPositiveFinite(current)) return null;
  if (lower !== null && !isPositiveFinite(lower)) return null;
  if (upper !== null && !isPositiveFinite(upper)) return null;

  const values = [current, ...(lower === null ? [] : [lower]), ...(upper === null ? [] : [upper])];
  for (const day of days) {
    for (const value of [day.close, day.low, day.high]) {
      if (value === null) continue;
      if (!isPositiveFinite(value)) return null;
      values.push(value);
    }
  }

  const logs = values.map((value) => Math.log(value));
  let lowest = Math.min(...logs);
  let highest = Math.max(...logs);
  if (highest === lowest) {
    lowest -= FLAT_HALF_SPAN;
    highest += FLAT_HALF_SPAN;
  }
  const padding = PRICE_CHART_PADDING * (highest - lowest);
  const start = lowest - padding;
  const end = highest + padding;

  const plotTop = PRICE_CHART.top;
  const plotBottom = PRICE_CHART.height - PRICE_CHART.bottom;
  const y = (value: number): number =>
    plotTop + (1 - (Math.log(value) - start) / (end - start)) * (plotBottom - plotTop);
  const x = (index: number): number => (days.length === 1 ? 50 : (index / (days.length - 1)) * 100);

  const upperY = upper === null ? null : y(upper);
  const lowerY = lower === null ? null : y(lower);

  return {
    points: days.map((day, index) => ({
      x: x(index),
      y: y(day.close),
      yLow: day.low === null ? null : y(day.low),
      yHigh: day.high === null ? null : y(day.high),
      placement: day.placement,
      date: day.date,
    })),
    plotTop,
    plotBottom,
    bandTop: upperY ?? plotTop,
    bandBottom: lowerY ?? plotBottom,
    upperY,
    lowerY,
    currentY: y(current),
  };
};
