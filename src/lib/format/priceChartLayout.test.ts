import { describe, expect, it } from "vitest";

import type { HistoricalPricePoint, Token } from "../../schemas";
import {
  type ChartDay,
  chartDays,
  layoutPriceChart,
  PRICE_CHART,
  PRICE_CHART_PADDING,
} from "./priceChartLayout";
import { choosePriceQuote } from "./priceQuote";

const USDC: Token = { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 };
const WETH: Token = { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 };
const pair = { token0: USDC, token1: WETH };

const day = (
  date: string,
  close: number,
  low: number | null = null,
  high: number | null = null,
  placement: ChartDay["placement"] = "undetermined",
): ChartDay => ({ date, close, low, high, placement });

const expectLayout = (input: Parameters<typeof layoutPriceChart>[0]) => {
  const layout = layoutPriceChart(input);
  if (layout === null) throw new Error("expected a layout");
  return layout;
};

const PLOT_HEIGHT = PRICE_CHART.height - PRICE_CHART.top - PRICE_CHART.bottom;

describe("chartDays", () => {
  /* The pool quotes ether in dollars; the chart, like the page, turns it round — extremes included. */
  const point = (price: number, low: number | null, high: number | null): HistoricalPricePoint =>
    ({ timestamp: "2026-09-10T00:00:00.000Z", price, low, high, volumeUsd: null, feesUsd: null }) as HistoricalPricePoint;

  it("turns each day the reader's way round, and swaps its extremes with it", () => {
    const quote = choosePriceQuote(pair, 1 / 3000);
    const [shown] = chartDays([point(1 / 3000, 1 / 3100, 1 / 2900)], quote, { lowerPrice: 1 / 3200, upperPrice: 1 / 2800 });

    expect(shown?.date).toBe("2026-09-10");
    expect(shown?.close).toBeCloseTo(3000, 9);
    expect(shown?.low).toBeCloseTo(2900, 9);
    expect(shown?.high).toBeCloseTo(3100, 9);
  });

  it("keeps a day's extremes absent when the source did not report them", () => {
    const quote = choosePriceQuote(pair, 1 / 3000);
    const [shown] = chartDays([point(1 / 3000, null, null)], quote, { lowerPrice: 1 / 3200, upperPrice: 1 / 2800 });

    expect(shown?.low).toBeNull();
    expect(shown?.high).toBeNull();
    expect(shown?.placement).toBe("undetermined");
  });

  /* Placement is counted in the pool's direction, by the rule the activity figures use. */
  it("places each day against the range the way the day counts are counted", () => {
    const quote = choosePriceQuote(pair, 1 / 3000);
    const range = { lowerPrice: 1 / 3200, upperPrice: 1 / 2800 };
    const [inside, outside, crossed] = chartDays(
      [point(1 / 3000, 1 / 3100, 1 / 2900), point(1 / 2500, 1 / 2600, 1 / 2400), point(1 / 2900, 1 / 3000, 1 / 2700)],
      quote,
      range,
    );

    expect(inside?.placement).toBe("inside");
    expect(outside?.placement).toBe("outside");
    expect(crossed?.placement).toBe("undetermined");
  });
});

describe("layoutPriceChart", () => {
  const month = Array.from({ length: 30 }, (_u, index) =>
    day(`2026-08-${String(index + 1).padStart(2, "0")}`, 3000 * (1 + 0.01 * Math.sin(index)), 2950, 3050, "inside"),
  );

  it("spreads the days across the whole width, first at the left and last at the right", () => {
    const layout = expectLayout({ days: month, lower: 2500, upper: 3600, current: 3000 });

    expect(layout.points[0]?.x).toBe(0);
    expect(layout.points[29]?.x).toBe(100);
    for (let index = 1; index < layout.points.length; index += 1) {
      expect(layout.points[index]!.x).toBeGreaterThan(layout.points[index - 1]!.x);
    }
  });

  it("puts a single day in the middle", () => {
    expect(expectLayout({ days: [month[0]!], lower: 2500, upper: 3600, current: 3000 }).points[0]?.x).toBe(50);
  });

  /* The geometric midpoint of the drawn span sits in the middle of the plot: a log scale. */
  it("lays prices out in log space", () => {
    const layout = expectLayout({ days: [day("2026-08-01", 200)], lower: 100, upper: 400, current: 200 });
    const middle = PRICE_CHART.top + PLOT_HEIGHT / 2;

    expect(layout.currentY).toBeCloseTo(middle, 9);
    expect(layout.points[0]?.y).toBeCloseTo(middle, 9);
    expect(layout.lowerY).toBeGreaterThan(layout.currentY);
    expect(layout.upperY).toBeLessThan(layout.currentY);
  });

  it("pads the drawn span by the stated share on each side", () => {
    const layout = expectLayout({ days: [day("2026-08-01", 200)], lower: 100, upper: 400, current: 200 });
    const span = Math.log(400) - Math.log(100);
    const padded = PRICE_CHART_PADDING * span;
    const scale = PLOT_HEIGHT / (span + 2 * padded);

    expect(layout.upperY).toBeCloseTo(PRICE_CHART.top + padded * scale, 9);
    expect(layout.lowerY).toBeCloseTo(PRICE_CHART.top + (padded + span) * scale, 9);
  });

  it("keeps every drawn value inside the plot", () => {
    const layout = expectLayout({ days: month, lower: 2500, upper: 3600, current: 3000 });
    const within = (value: number) => value >= layout.plotTop && value <= layout.plotBottom;

    expect(within(layout.currentY)).toBe(true);
    expect(layout.points.every((point) => within(point.y) && within(point.yLow!) && within(point.yHigh!))).toBe(true);
    expect(layout.bandTop).toBeGreaterThanOrEqual(layout.plotTop);
    expect(layout.bandBottom).toBeLessThanOrEqual(layout.plotBottom);
  });

  it("widens the drawn span to hold a day outside the range", () => {
    const far = [...month, day("2026-08-31", 5000, 4900, 5100, "outside")];
    const layout = expectLayout({ days: far, lower: 2500, upper: 3600, current: 3000 });

    expect(layout.points[30]?.y).toBeGreaterThanOrEqual(layout.plotTop);
    expect(layout.points[30]?.y).toBeLessThan(layout.upperY!);
  });

  it("carries a day's placement and date through", () => {
    const layout = expectLayout({ days: [day("2026-08-01", 3000, null, null, "outside")], lower: 2500, upper: 3600, current: 3000 });

    expect(layout.points[0]?.placement).toBe("outside");
    expect(layout.points[0]?.date).toBe("2026-08-01");
    expect(layout.points[0]?.yLow).toBeNull();
    expect(layout.points[0]?.yHigh).toBeNull();
  });

  /* An edge the pool could not express is open: the band runs to the plot's own edge, and no line is drawn for it. */
  it("runs the band off the chart at an open edge", () => {
    const layout = expectLayout({ days: month, lower: null, upper: 3600, current: 3000 });

    expect(layout.lowerY).toBeNull();
    expect(layout.bandBottom).toBe(layout.plotBottom);
    expect(layout.upperY).not.toBeNull();
    expect(layout.bandTop).toBe(layout.upperY!);

    const open = expectLayout({ days: month, lower: 2500, upper: null, current: 3000 });
    expect(open.bandTop).toBe(open.plotTop);
    expect(open.bandBottom).toBe(open.lowerY!);
  });

  it("still draws a month whose price never moved", () => {
    const flat = Array.from({ length: 5 }, (_u, index) => day(`2026-08-0${index + 1}`, 1));
    const layout = expectLayout({ days: flat, lower: null, upper: null, current: 1 });

    expect(Number.isFinite(layout.currentY)).toBe(true);
    expect(layout.currentY).toBeCloseTo(PRICE_CHART.top + PLOT_HEIGHT / 2, 9);
  });

  it("draws nothing for no days, or for a value that is not a price", () => {
    expect(layoutPriceChart({ days: [], lower: 2500, upper: 3600, current: 3000 })).toBeNull();
    expect(layoutPriceChart({ days: [day("2026-08-01", 0)], lower: 2500, upper: 3600, current: 3000 })).toBeNull();
    expect(layoutPriceChart({ days: [day("2026-08-01", 3000, -1, 3100)], lower: 2500, upper: 3600, current: 3000 })).toBeNull();
    expect(layoutPriceChart({ days: [day("2026-08-01", 3000)], lower: 0, upper: 3600, current: 3000 })).toBeNull();
    expect(layoutPriceChart({ days: [day("2026-08-01", 3000)], lower: 2500, upper: Infinity, current: 3000 })).toBeNull();
    expect(layoutPriceChart({ days: [day("2026-08-01", 3000)], lower: 2500, upper: 3600, current: NaN })).toBeNull();
  });
});
