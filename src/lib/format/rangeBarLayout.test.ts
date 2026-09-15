import { describe, expect, it } from "vitest";

import { layoutRangeBar, RANGE_BAR_PADDING } from "./rangeBarLayout";

const expectLayout = (input: Parameters<typeof layoutRangeBar>[0]) => {
  const layout = layoutRangeBar(input);
  if (layout === null) throw new Error("expected a layout");
  return layout;
};

describe("layoutRangeBar", () => {
  it("pads the range by the stated share of its width on each side", () => {
    const layout = expectLayout({ lower: 100, upper: 200, current: 141.42 });
    const padded = (100 * RANGE_BAR_PADDING) / (1 + 2 * RANGE_BAR_PADDING);

    expect(layout.lower).toBeCloseTo(padded, 9);
    expect(layout.upper).toBeCloseTo(100 - padded, 9);
  });

  /* The geometric midpoint sits in the middle, not the arithmetic one. */
  it("lays the bar out in log space", () => {
    const layout = expectLayout({ lower: 100, upper: 400, current: 200 });

    expect(layout.current).toBeCloseTo(50, 9);
    expect(expectLayout({ lower: 100, upper: 400, current: 250 }).current).not.toBeCloseTo(50, 3);
  });

  it("is unchanged when every price is scaled by the same factor", () => {
    const small = expectLayout({ lower: 1 / 3700, upper: 1 / 3150, current: 1 / 3412 });
    const large = expectLayout({ lower: 1e6 / 3700, upper: 1e6 / 3150, current: 1e6 / 3412 });

    expect(small.lower).toBeCloseTo(large.lower, 9);
    expect(small.upper).toBeCloseTo(large.upper, 9);
    expect(small.current).toBeCloseTo(large.current, 9);
  });

  /* Inverting the quote mirrors the bar, which is what a reader would expect. */
  it("mirrors when the prices are inverted", () => {
    const pool = expectLayout({ lower: 1 / 3700, upper: 1 / 3150, current: 1 / 3412 });
    const shown = expectLayout({ lower: 3150, upper: 3700, current: 3412 });

    expect(shown.lower).toBeCloseTo(100 - pool.upper, 9);
    expect(shown.upper).toBeCloseTo(100 - pool.lower, 9);
    expect(shown.current).toBeCloseTo(100 - pool.current, 9);
  });

  it("keeps a current price outside the range on the bar, beyond the padding", () => {
    const below = expectLayout({ lower: 100, upper: 200, current: 50 });

    expect(below.current).toBeCloseTo(
      (100 * RANGE_BAR_PADDING) / (1 + Math.log2(4) - Math.log2(2) + 2 * RANGE_BAR_PADDING),
      9,
    );
    expect(below.current).toBeLessThan(below.lower);
    expect(below.upper).toBeLessThan(100);

    const above = expectLayout({ lower: 100, upper: 200, current: 400 });
    expect(above.current).toBeGreaterThan(above.upper);
    expect(above.lower).toBeGreaterThan(0);
  });

  it("stays within the bar for every input", () => {
    for (const current of [1e-9, 1, 150, 1e9]) {
      const layout = expectLayout({ lower: 100, upper: 200, current });
      for (const position of [layout.lower, layout.upper, layout.current]) {
        expect(position).toBeGreaterThanOrEqual(0);
        expect(position).toBeLessThanOrEqual(100);
      }
    }
  });

  it("draws nothing for a range with no width or a price that is not one", () => {
    expect(layoutRangeBar({ lower: 200, upper: 200, current: 200 })).toBeNull();
    expect(layoutRangeBar({ lower: 300, upper: 200, current: 250 })).toBeNull();
    expect(layoutRangeBar({ lower: 0, upper: 200, current: 100 })).toBeNull();
    expect(layoutRangeBar({ lower: 100, upper: Infinity, current: 100 })).toBeNull();
    expect(layoutRangeBar({ lower: 100, upper: 200, current: NaN })).toBeNull();
  });
});
