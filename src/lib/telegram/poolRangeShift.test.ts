import { describe, expect, it } from "vitest";

import { hasRangeMoved, mayRetell, POOL_RANGE_RETELL_MS, POOL_RANGE_SHIFT_SHARE, type PriceRange, shouldTell } from "./poolRangeShift";

/* WETH per USDC, 0.0003 to 0.0005: a width of ln(5/3) ≈ 0.51 in logarithms, so a tenth is ≈ 0.051. */
const TOLD: PriceRange = [0.0003, 0.0005];
const WIDTH = Math.log(TOLD[1] / TOLD[0]);

/** An edge moved by `share` of the range's log-width, the other left where it was. */
const movedLower = (share: number): PriceRange => [TOLD[0] * Math.exp(share * WIDTH), TOLD[1]];
const movedUpper = (share: number): PriceRange => [TOLD[0], TOLD[1] * Math.exp(share * WIDTH)];

/** The double `k` steps away from `x`. */
const ulps = (x: number, k: number): number => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(k));
  return view.getFloat64(0);
};

/**
 * A told range from 1 to about e, and a lower edge now whose log-ratio is
 * exactly a tenth of that width in the guard's own arithmetic. The lower
 * edge told is 1, so `now / then` is `now` and nothing is lost in a division.
 */
const onThreshold = (): { then: PriceRange; now: PriceRange } => {
  for (let i = -400; i <= 400; i += 1) {
    const upper = ulps(Math.E, i);
    const threshold = POOL_RANGE_SHIFT_SHARE * Math.log(upper / 1);
    const guess = Math.exp(threshold);
    for (let j = -6; j <= 6; j += 1) {
      const edge = ulps(guess, j);
      if (Math.log(edge / 1) === threshold) return { then: [1, upper], now: [edge, upper] };
    }
  }
  throw new Error("no pair of doubles meets exactly on the threshold");
};

describe("whether a suggested range has moved far enough to say so", () => {
  it("is a tenth of the range's own width in logarithms", () => {
    expect(POOL_RANGE_SHIFT_SHARE).toBe(0.1);
  });

  it("counts the lower edge moving by more than a tenth, either way", () => {
    expect(hasRangeMoved(TOLD, movedLower(0.11))).toBe(true);
    expect(hasRangeMoved(TOLD, movedLower(-0.11))).toBe(true);
    expect(hasRangeMoved(TOLD, movedLower(0.09))).toBe(false);
    expect(hasRangeMoved(TOLD, movedLower(-0.09))).toBe(false);
  });

  it("counts the upper edge moving by more than a tenth, either way", () => {
    expect(hasRangeMoved(TOLD, movedUpper(0.11))).toBe(true);
    expect(hasRangeMoved(TOLD, movedUpper(-0.11))).toBe(true);
    expect(hasRangeMoved(TOLD, movedUpper(0.09))).toBe(false);
    expect(hasRangeMoved(TOLD, movedUpper(-0.09))).toBe(false);
  });

  /*
   * Pinned on doubles whose log-ratio *is* the threshold, found by walking
   * neighbouring doubles until the two sides of the guard's own arithmetic
   * agree exactly: a value a rounding error under the threshold would pass
   * this test for the wrong reason, with the guard made inclusive.
   */
  it("is strict at the threshold: exactly a tenth is not yet a move, the next double up is", () => {
    const { then, now } = onThreshold();
    const [edge, upper] = now;

    expect(hasRangeMoved(then, now)).toBe(false);
    expect(hasRangeMoved(then, [ulps(edge, 1), upper])).toBe(true);
    expect(hasRangeMoved(then, [ulps(edge, -1), upper])).toBe(false);
  });

  it("compares prices and not ratios to the current price, so the same range at a new price is no move", () => {
    expect(hasRangeMoved(TOLD, [0.0003, 0.0005])).toBe(false);
  });

  it("is not fooled by two edges each a little short of a tenth", () => {
    expect(hasRangeMoved(TOLD, [TOLD[0] * Math.exp(0.09 * WIDTH), TOLD[1] * Math.exp(0.09 * WIDTH)])).toBe(false);
  });

  it("never fires on a range it cannot measure: a told width of nothing, or a non-positive edge now", () => {
    expect(hasRangeMoved([0.0004, 0.0004], [0.0003, 0.0005])).toBe(false);
    expect(hasRangeMoved([0.0005, 0.0003], [0.0003, 0.0005])).toBe(false);
    expect(hasRangeMoved(TOLD, [0, 0.0005])).toBe(false);
    expect(hasRangeMoved(TOLD, [0.0003, Number.NaN])).toBe(false);
  });
});

describe("the once-a-day rule", () => {
  const told = "2026-10-07T09:00:00.000Z";

  it("holds a second message back until a full day has passed since the last", () => {
    expect(POOL_RANGE_RETELL_MS).toBe(24 * 60 * 60 * 1_000);
    expect(mayRetell(told, new Date("2026-10-07T09:00:00.000Z"))).toBe(false);
    expect(mayRetell(told, new Date("2026-10-08T08:59:59.999Z"))).toBe(false);
    expect(mayRetell(told, new Date("2026-10-08T09:00:00.000Z"))).toBe(true);
    expect(mayRetell(told, new Date("2026-10-09T09:00:00.000Z"))).toBe(true);
  });

  it("lets a record whose time cannot be read be told, rather than never again", () => {
    expect(mayRetell("not a time", new Date("2026-10-07T09:00:00.000Z"))).toBe(true);
  });

  it("tells only when both rules say so", () => {
    const moved = movedUpper(0.2);
    expect(shouldTell(TOLD, told, moved, new Date("2026-10-08T09:00:00.000Z"))).toBe(true);
    expect(shouldTell(TOLD, told, moved, new Date("2026-10-07T20:00:00.000Z"))).toBe(false);
    expect(shouldTell(TOLD, told, movedUpper(0.05), new Date("2026-10-08T09:00:00.000Z"))).toBe(false);
  });
});
