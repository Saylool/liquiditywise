import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { type ChartDay, layoutPriceChart } from "../lib/format/priceChartLayout";
import { PriceHistoryChart } from "./PriceHistoryChart";

const day = (date: string, close: number, placement: ChartDay["placement"], low: number | null = close * 0.99, high: number | null = close * 1.01): ChartDay =>
  ({ date, close, low, high, placement });

const days: ChartDay[] = [
  day("2026-08-01", 3000, "inside"),
  day("2026-08-02", 3050, "inside"),
  day("2026-08-03", 3700, "outside"),
  day("2026-08-04", 3500, "undetermined"),
  day("2026-08-05", 3100, "inside", null, null),
];

const render = (lower: number | null = 2500, upper: number | null = 3600) => {
  const layout = layoutPriceChart({ days, lower, upper, current: 3100 });
  if (layout === null) throw new Error("fixture should lay out");
  return renderToStaticMarkup(
    <PriceHistoryChart
      layout={layout}
      labels={{ current: "3,100", upper: "3,600", lower: "2,500", first: "2026-08-01", last: "2026-08-05" }}
      label="The last month's prices against the suggested range"
    />,
  );
};

describe("PriceHistoryChart", () => {
  it("is one labelled image with a dot per day", () => {
    const markup = render();

    expect(markup).toContain('role="img" aria-label="The last month');
    expect(markup.match(/<circle /g)?.length).toBe(days.length);
  });

  /* Filled inside the range, hollow outside it or across an edge — the same rule as the day counts. */
  it("fills a day that stayed inside and leaves the others hollow", () => {
    const markup = render();
    const circles = markup.match(/<circle [^>]*>/g) ?? [];

    expect(circles.filter((circle) => circle.includes("fill-accent")).length).toBe(3);
    expect(circles.filter((circle) => circle.includes("fill-surface")).length).toBe(2);
    expect(circles.filter((circle) => circle.includes('data-placement="outside"')).length).toBe(1);
  });

  it("draws a whisker only for a day with extremes", () => {
    const markup = render();

    expect(markup.match(/stroke-muted" stroke-opacity/g)?.length).toBe(4);
  });

  it("joins the closes with one segment fewer than there are days", () => {
    expect(render().match(/stroke-foreground" stroke-width="1.25"/g)?.length).toBe(days.length - 1);
  });

  it("labels the edges, the current price and the month's ends", () => {
    const markup = render();

    for (const text of ["3,600", "2,500", "3,100", "2026-08-01", "2026-08-05"]) expect(markup).toContain(`>${text}</text>`);
    expect(markup.match(/stroke-dasharray="4 4"/g)?.length).toBe(2);
  });

  it("draws no line and no label for an open edge", () => {
    const markup = render(null, 3600);

    expect(markup).not.toContain(">2,500</text>");
    expect(markup).toContain(">3,600</text>");
    expect(markup.match(/stroke-dasharray="4 4"/g)?.length).toBe(1);
  });

  it("runs the band to the plot's own edge where the edge is open", () => {
    const open = render(2500, null);
    const closed = render(2500, 3600);
    const bandOf = (markup: string) => /<rect x="0" y="([\d.]+)" width="100%" height="([\d.]+)"/.exec(markup);

    expect(bandOf(open)?.[1]).toBe("16"); // the plot's top
    expect(Number(bandOf(open)?.[2])).toBeGreaterThan(Number(bandOf(closed)?.[2]));
  });

  /* No viewBox: the text stays the size it is whatever the width. */
  it("sizes itself by width, not by a scaled viewBox", () => {
    const markup = render();

    expect(markup).toContain('width="100%"');
    expect(markup).not.toContain("viewBox");
  });
});
