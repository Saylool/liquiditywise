import { describe, expect, it } from "vitest";

import { RangeOrderLegSchema, RangeOrdersSchema } from "./rangeOrder";

const above = {
  placement: "above" as const,
  lowerTick: 60,
  upperTick: 1_200,
  lowerPrice: 1.006,
  upperPrice: 1.1275,
  averagePrice: Math.sqrt(1.006) * Math.sqrt(1.1275),
};

const below = {
  placement: "below" as const,
  lowerTick: -1_200,
  upperTick: 0,
  lowerPrice: 0.8869,
  upperPrice: 1,
  averagePrice: Math.sqrt(0.8869),
};

describe("RangeOrderLegSchema", () => {
  it("accepts a leg of the shape the calculator produces", () => {
    expect(RangeOrderLegSchema.parse(above)).toEqual(above);
  });

  /*
   * The geometric mean of two distinct positive numbers lies strictly between
   * them, so an average outside the bounds is an average of the wrong pair — and
   * it would still be a positive price, and would still look like one.
   */
  it.each([
    ["an average below its band", { averagePrice: 0.9 }],
    ["an average above its band", { averagePrice: 2 }],
    ["an average at a bound", { averagePrice: 1.006 }],
    ["bounds the wrong way round", { lowerPrice: 1.1275, upperPrice: 1.006 }],
    ["ticks the wrong way round", { lowerTick: 1_200, upperTick: 60 }],
    ["a band of no width", { lowerTick: 60, upperTick: 60 }],
    ["a side nobody declared", { placement: "beside" }],
    ["a field nobody declared", { fills: true }],
  ])("rejects %s", (_label, overrides) => {
    expect(RangeOrderLegSchema.safeParse({ ...above, ...overrides }).success).toBe(false);
  });
});

describe("RangeOrdersSchema", () => {
  it("accepts both sides", () => {
    expect(RangeOrdersSchema.safeParse({ above, below }).success).toBe(true);
  });

  it.each([
    ["only the selling side", { above, below: null }],
    ["only the buying side", { above: null, below }],
  ])("accepts %s, because a range can be against one edge", (_label, orders) => {
    expect(RangeOrdersSchema.safeParse(orders).success).toBe(true);
  });

  it("refuses a pair with nothing in it", () => {
    expect(RangeOrdersSchema.safeParse({ above: null, below: null }).success).toBe(false);
  });

  /*
   * They sit on opposite sides of one price by construction. Overlapping legs
   * would mean the split was computed from two different prices.
   */
  it("refuses legs that overlap", () => {
    const result = RangeOrdersSchema.safeParse({
      above,
      below: { ...below, upperTick: 600, upperPrice: 1.0618, averagePrice: Math.sqrt(0.8869 * 1.0618) },
    });

    expect(result.success).toBe(false);
  });
});
