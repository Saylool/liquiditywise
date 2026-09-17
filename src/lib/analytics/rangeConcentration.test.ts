import { describe, expect, it } from "vitest";

import { liquidityPerUnitValue, relativeFeeShare } from "./rangeConcentration";

const PRICE = 2500;
/** The whole curve, as a pool with no concentration would be: `1 / (2√P)`. */
const FULL_RANGE = { lowerPrice: 0, upperPrice: Number.POSITIVE_INFINITY };

describe("liquidityPerUnitValue", () => {
  /*
   * The constant-product case, where a deposit is spread over every price:
   * the denominator loses both bounds and the answer is `1 / (2√P)`.
   */
  it("is the unconcentrated figure over the whole curve", () => {
    expect(liquidityPerUnitValue(FULL_RANGE, PRICE)).toBeCloseTo(1 / (2 * Math.sqrt(PRICE)), 15);
  });

  /*
   * Two hand-computable ranges. From a quarter of the price to four times it,
   * the bracket is 2√P − √P/2 − √P/2 = √P, which is exactly twice the
   * liquidity of the whole curve; from a ninth to nine times, exactly half as
   * much again.
   */
  it.each([
    ["a quarter to four times the price", 4, 2],
    ["a ninth to nine times the price", 9, 1.5],
  ])("concentrates a deposit %s by the factor the formula gives", (_label, factor, expected) => {
    const range = { lowerPrice: PRICE / factor, upperPrice: PRICE * factor };

    expect(relativeFeeShare(range, FULL_RANGE, PRICE)).toBeCloseTo(expected, 12);
  });

  it("gives a narrower range more of the same deposit's liquidity", () => {
    const tight = liquidityPerUnitValue({ lowerPrice: 2400, upperPrice: 2600 }, PRICE);
    const wide = liquidityPerUnitValue({ lowerPrice: 2000, upperPrice: 3000 }, PRICE);

    expect(tight).not.toBeNull();
    expect(wide).not.toBeNull();
    expect(tight ?? 0).toBeGreaterThan(wide ?? 0);
  });

  /* A position sitting on an edge is entirely one token, and still has a value. */
  it.each([
    ["the lower edge", 2000],
    ["the upper edge", 3000],
  ])("values a position whose price sits on %s", (_label, price) => {
    expect(liquidityPerUnitValue({ lowerPrice: 2000, upperPrice: 3000 }, price)).toBeGreaterThan(0);
  });

  it.each([
    ["below the range", 1999],
    ["above the range", 3001],
  ])("has no answer for a price %s", (_label, price) => {
    expect(liquidityPerUnitValue({ lowerPrice: 2000, upperPrice: 3000 }, price)).toBeNull();
  });

  it.each([
    ["a zero-width range", { lowerPrice: PRICE, upperPrice: PRICE }, PRICE],
    ["a price of zero", { lowerPrice: 0, upperPrice: 1 }, 0],
    ["a price that is not a number", { lowerPrice: 1, upperPrice: 2 }, Number.NaN],
  ])("has no answer for %s", (_label, range, price) => {
    expect(liquidityPerUnitValue(range, price)).toBeNull();
  });
});

describe("relativeFeeShare", () => {
  const tight = { lowerPrice: 2400, upperPrice: 2600 };
  const wide = { lowerPrice: 2000, upperPrice: 3000 };

  it("is one against itself", () => {
    expect(relativeFeeShare(tight, tight, PRICE)).toBeCloseTo(1, 15);
  });

  it("is reciprocal between two ranges", () => {
    const forward = relativeFeeShare(tight, wide, PRICE) ?? 0;
    const back = relativeFeeShare(wide, tight, PRICE) ?? 0;

    expect(forward).toBeGreaterThan(1);
    expect(forward * back).toBeCloseTo(1, 12);
  });

  /*
   * The page writes every price the way round that reads best, which inverts
   * the bounds and the price together. The figure on its own changes with that
   * — it is in units of whichever token the deposit is measured in — but the
   * ratio it is only ever shown as does not.
   */
  it("is unchanged when every price is written the other way round", () => {
    const invert = (range: { lowerPrice: number; upperPrice: number }) => ({
      lowerPrice: 1 / range.upperPrice,
      upperPrice: 1 / range.lowerPrice,
    });

    expect(relativeFeeShare(invert(tight), invert(wide), 1 / PRICE)).toBeCloseTo(
      relativeFeeShare(tight, wide, PRICE) ?? 0,
      12,
    );
  });

  it("has no answer when either range cannot hold the price", () => {
    expect(relativeFeeShare(tight, wide, 2100)).toBeNull();
    expect(relativeFeeShare(wide, tight, 2100)).toBeNull();
  });
});
