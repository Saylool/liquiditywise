import { describe, expect, it } from "vitest";

import type { TickRange } from "../../schemas";
import { calculateDivergenceLoss } from "./divergenceLoss";

/**
 * A range is described here by the three numbers this calculation actually uses.
 * Everything else on a `TickRange` — ticks, truncation flags, the pool it
 * belongs to — is irrelevant to arithmetic that only knows about prices.
 */
const rangeOf = (lowerPrice: number, upperPrice: number, currentPrice: number) =>
  ({ lowerPrice, upperPrice, band: { currentPrice } }) as unknown as TickRange;

const succeeded = (result: ReturnType<typeof calculateDivergenceLoss>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.notice}`);
  return result.data;
};

const at = (range: TickRange, price: number): number => {
  const point = succeeded(calculateDivergenceLoss(range)).points.find((p) => p.price === price);
  if (point === undefined) throw new Error(`no point at ${price}`);
  return point.lossRatio;
};

describe("calculateDivergenceLoss", () => {
  /*
   * Worked by hand. Range [1, 4] entered at 2: one unit of liquidity holds
   * 0.207107 of token0 and 0.414214 of token1. At the upper edge it is all
   * token1 — exactly 1 — against a holding then worth 1.242641.
   */
  it("matches the arithmetic worked out by hand", () => {
    expect(at(rangeOf(1, 4, 2), 4)).toBeCloseTo(-0.195262, 6);
  });

  /*
   * A range symmetric in log space around the entry loses the same at both
   * edges. Price movement is symmetric in logs and so is this curve; a formula
   * with the roots the wrong way round would not be.
   */
  it("loses the same at both edges of a log-symmetric range", () => {
    const range = rangeOf(1, 4, 2);

    expect(at(range, 1)).toBeCloseTo(at(range, 4), 12);
  });

  it("is zero at the price the position was opened at", () => {
    expect(at(rangeOf(1, 4, 2), 2)).toBe(0);
  });

  /*
   * Concentration is the whole point of v3 and it cuts both ways: the same 2×
   * move costs a full-range position about 5.7%, and far more in a tight range.
   */
  it("costs more in a tighter range than a wider one for the same move", () => {
    // Both reach 4, so both are evaluated there and the move compared is one move.
    const tight = at(rangeOf(1, 4, 2), 4);
    const wide = at(rangeOf(0.25, 4, 2), 4);

    expect(tight).toBeLessThan(wide);
  });

  it("never reports a gain", () => {
    for (const [lower, upper, current] of [
      [1, 4, 2],
      [1, 4, 1.2],
      [1, 4, 3.9],
      [0.0001, 0.0004, 0.0002],
      [1000, 4000, 2500],
    ] as const) {
      for (const point of succeeded(calculateDivergenceLoss(rangeOf(lower, upper, current)))
        .points) {
        expect(point.lossRatio).toBeLessThanOrEqual(0);
      }
    }
  });

  it("never reports losing more than everything", () => {
    for (const point of succeeded(calculateDivergenceLoss(rangeOf(1, 1e6, 1000))).points) {
      expect(point.lossRatio).toBeGreaterThanOrEqual(-1);
    }
  });

  it("gets worse the further price moves from the entry", () => {
    const { points } = succeeded(calculateDivergenceLoss(rangeOf(1, 4, 2)));
    const entryIndex = points.findIndex((point) => point.lossRatio === 0);

    for (let i = entryIndex; i + 1 < points.length; i += 1) {
      expect(points[i + 1]?.lossRatio).toBeLessThanOrEqual(points[i]?.lossRatio ?? 0);
    }
    for (let i = entryIndex; i > 0; i -= 1) {
      expect(points[i - 1]?.lossRatio).toBeLessThanOrEqual(points[i]?.lossRatio ?? 0);
    }
  });

  it("evaluates at both edges and at the current price", () => {
    const { points, entryPrice } = succeeded(calculateDivergenceLoss(rangeOf(1, 4, 2)));
    const prices = points.map((point) => point.price);

    expect(entryPrice).toBe(2);
    expect(prices[0]).toBe(1);
    expect(prices.at(-1)).toBe(4);
    expect(prices).toContain(2);
  });

  it("spaces the points geometrically, as price movement is", () => {
    const prices = succeeded(calculateDivergenceLoss(rangeOf(1, 4, 2))).points.map((p) => p.price);

    expect(prices).toHaveLength(5);
    expect(prices[1]).toBeCloseTo(Math.sqrt(2), 12);
    expect(prices[3]).toBeCloseTo(Math.sqrt(8), 12);
  });

  /*
   * The range is the one the page recommends, but the pool's price can have left
   * it — the report flags exactly that case — and the comparison is still
   * defined.
   */
  it("still answers when the pool's price sits outside the range", () => {
    const below = succeeded(calculateDivergenceLoss(rangeOf(2, 4, 1)));
    const above = succeeded(calculateDivergenceLoss(rangeOf(1, 2, 4)));

    expect(below.points.length).toBeGreaterThan(1);
    expect(above.points.length).toBeGreaterThan(1);
  });

  it("gives the same answer whatever the prices are scaled by", () => {
    // A ratio of portfolios cannot depend on the units the pair is quoted in.
    const small = at(rangeOf(1, 4, 2), 4);
    const large = at(rangeOf(1e6, 4e6, 2e6), 4e6);

    expect(small).toBeCloseTo(large, 10);
  });

  it("drops a duplicate row when the price sits exactly on an edge", () => {
    const { points } = succeeded(calculateDivergenceLoss(rangeOf(1, 4, 1)));

    expect(new Set(points.map((point) => point.price)).size).toBe(points.length);
  });
});
