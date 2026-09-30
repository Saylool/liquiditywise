import { describe, expect, it } from "vitest";

import { rangeAroundInverted, signedPercent } from "./rangeAround";

describe("a range around the price", () => {
  it("is each edge's ratio less one when the pair is quoted as computed", () => {
    expect(rangeAroundInverted(false, 0.95, 1.02)).toEqual({ below: 0.95 - 1, above: 1.02 - 1 });
  });

  it("swaps the ends and takes reciprocals when the pair is quoted the other way, so the lower edge stays lower", () => {
    const { below, above } = rangeAroundInverted(true, 0.95, 1.02);

    expect(below).toBeCloseTo(1 / 1.02 - 1, 12);
    expect(above).toBeCloseTo(1 / 0.95 - 1, 12);
    expect(below).toBeLessThan(above);
  });
});

describe("a signed percentage", () => {
  it("writes the plus that a percentage does not, and only for a rise", () => {
    expect(signedPercent(0.0526, "en")).toBe("+5.26%");
    expect(signedPercent(-0.0196, "en")).toBe("-1.96%");
    expect(signedPercent(0, "en")).toBe("0.00%");
  });
});
