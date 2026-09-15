import { describe, expect, it } from "vitest";

import { priceStepRatio } from "./priceStep";

describe("priceStepRatio", () => {
  it("is one basis point for a spacing of one", () => {
    expect(priceStepRatio(1)).toBeCloseTo(0.0001, 12);
  });

  /* The spacings Uniswap v3 deploys, as the percentages the page prints. */
  it("grows with the spacing, compounding rather than multiplying", () => {
    expect(priceStepRatio(10)).toBeCloseTo(0.00100045, 9);
    expect(priceStepRatio(60)).toBeCloseTo(0.00601773, 8);
    expect(priceStepRatio(200)).toBeCloseTo(0.02020032, 8);
    expect(priceStepRatio(200)).toBeGreaterThan(200 * 0.0001);
  });

  it("is zero for a spacing of zero and nothing else", () => {
    expect(priceStepRatio(0)).toBe(0);
    expect(priceStepRatio(1)).toBeGreaterThan(0);
  });
});
