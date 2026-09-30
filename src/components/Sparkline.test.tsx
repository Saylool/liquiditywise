import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Sparkline, sparklinePoints } from "./Sparkline";

describe("the points of a small line", () => {
  it("run from the series' own smallest, at the bottom, to its largest, at the top, evenly across", () => {
    expect(sparklinePoints([1, 3, 2])).toBe("2.0,26.0 60.0,2.0 118.0,14.0");
  });

  it("are a flat line through the middle for a series that never moves", () => {
    expect(sparklinePoints([5, 5, 5])).toBe("2.0,14.0 60.0,14.0 118.0,14.0");
  });

  it("are none for fewer than two values, or for a value that is not a number", () => {
    expect(sparklinePoints([])).toBeNull();
    expect(sparklinePoints([1])).toBeNull();
    expect(sparklinePoints([1, Number.NaN])).toBeNull();
    expect(sparklinePoints([1, Number.POSITIVE_INFINITY])).toBeNull();
  });
});

describe("the small line", () => {
  it("is a labelled image for a screen reader, and draws nothing when there is no line", () => {
    const html = renderToStaticMarkup(<Sparkline values={[1, 2]} label="Range width, from 10% to 20%" />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Range width, from 10% to 20%"');
    expect(html).toContain("<polyline");
    expect(renderToStaticMarkup(<Sparkline values={[1]} label="x" />)).toBe("");
  });
});
