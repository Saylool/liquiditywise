import { describe, expect, it } from "vitest";

import { SwapDepthSchema, SwapLegSchema } from "./swapDepth";

/*
 * Built from the protocol's two brackets rather than typed out, so the
 * acceptance cases satisfy the one refinement that ties the amounts to the
 * price. The rejections below are what this file is actually for.
 */
const SPOT = 1.003;
const LOW_EDGE = 1;
const HIGH_EDGE = 1.0060180118324795;
const rootSpot = Math.sqrt(SPOT);
const rootLow = Math.sqrt(LOW_EDGE);
const rootHigh = Math.sqrt(HIGH_EDGE);

const sell0 = {
  tokenIn: "token0" as const,
  amountIn: 1 / rootLow - 1 / rootSpot,
  amountOut: rootSpot - rootLow,
  edgePrice: LOW_EDGE,
  averagePrice: rootSpot * rootLow,
  costRatio: 1 - (rootSpot * rootLow) / SPOT,
};

const sell1 = {
  tokenIn: "token1" as const,
  amountIn: rootHigh - rootSpot,
  amountOut: 1 / rootSpot - 1 / rootHigh,
  edgePrice: HIGH_EDGE,
  averagePrice: rootSpot * rootHigh,
  costRatio: (rootSpot * rootHigh) / SPOT - 1,
};

const depth = (overrides: Record<string, unknown> = {}) => ({
  sellingToken0: sell0,
  sellingToken1: sell1,
  spotPrice: SPOT,
  ...overrides,
});

describe("SwapLegSchema", () => {
  it.each([
    ["a sale of token0", sell0],
    ["a sale of token1", sell1],
  ])("accepts %s as the calculator produces it", (_label, leg) => {
    expect(SwapLegSchema.safeParse(leg).success).toBe(true);
  });

  /*
   * The amounts and the price come out of two different brackets of the same
   * formula. This is the only place a mistake in either would show.
   */
  it("refuses amounts that do not divide into the average price", () => {
    const result = SwapLegSchema.safeParse({ ...sell0, amountOut: sell0.amountOut * 1.01 });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "averagePrice")).toBe(true);
  });

  it("refuses a leg whose direction is the other way round", () => {
    /* The same numbers, relabelled: token1 in must divide the other way. */
    expect(SwapLegSchema.safeParse({ ...sell0, tokenIn: "token1" }).success).toBe(false);
  });

  it.each([
    ["nothing going in", { amountIn: 0 }],
    ["nothing coming out", { amountOut: 0 }],
    ["a negative cost", { costRatio: -0.01 }],
    ["an edge price of zero", { edgePrice: 0 }],
    ["a side nobody declared", { tokenIn: "token2" }],
    ["a field nobody declared", { slippage: 0.1 }],
  ])("refuses %s", (_label, overrides) => {
    expect(SwapLegSchema.safeParse({ ...sell0, ...overrides }).success).toBe(false);
  });
});

describe("SwapDepthSchema", () => {
  it("accepts both directions", () => {
    expect(SwapDepthSchema.safeParse(depth()).success).toBe(true);
  });

  it("accepts one direction, because a price can sit on a boundary", () => {
    expect(SwapDepthSchema.safeParse(depth({ sellingToken0: null })).success).toBe(true);
  });

  it("refuses a pair with neither", () => {
    expect(
      SwapDepthSchema.safeParse(depth({ sellingToken0: null, sellingToken1: null })).success,
    ).toBe(false);
  });

  /*
   * Selling token0 can only walk the price down and token1 only up. A leg whose
   * edge is on the wrong side of the spot is a direction computed backwards,
   * and every figure in it would still look ordinary.
   */
  it.each([
    [
      "a sale of token0 that raises the price",
      { sellingToken0: { ...sell0, edgePrice: 1.1, averagePrice: rootSpot * Math.sqrt(1.1) } },
    ],
    [
      "a sale of token1 that lowers it",
      { sellingToken1: { ...sell1, edgePrice: 0.9, averagePrice: rootSpot * Math.sqrt(0.9) } },
    ],
  ])("refuses %s", (_label, overrides) => {
    expect(SwapDepthSchema.safeParse(depth(overrides)).success).toBe(false);
  });
});
