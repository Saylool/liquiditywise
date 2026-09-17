import { describe, expect, it } from "vitest";

import type { Pool, TickRange } from "../../schemas";
import { priceAtTick } from "../uniswap/v3TickMath";
import { calculateRangeOrders } from "./rangeOrder";

/*
 * Eighteen decimals on both sides, so a tick's price is around one and the
 * numbers in the expectations can be read. Sixty is the spacing of a 0.30% pool.
 */
const TICK_SPACING = 60;
const DECIMALS = { token0Decimals: 18, token1Decimals: 18 };

const pool = (tickSpacing = TICK_SPACING): Pool =>
  ({
    tickSpacing,
    token0: { decimals: 18 },
    token1: { decimals: 18 },
  }) as unknown as Pool;

/** Only three fields are read from a range, and these are them. */
const range = (currentTick: number, lowerTick = -1_200, upperTick = 1_200): TickRange =>
  ({ currentTick, lowerTick, upperTick }) as unknown as TickRange;

const succeed = (currentTick: number, lowerTick?: number, upperTick?: number, spacing?: number) => {
  const result = calculateRangeOrders({
    pool: pool(spacing),
    range: range(currentTick, lowerTick, upperTick),
  });
  if (result.status === "unavailable") throw new Error(`expected legs: ${result.notice}`);
  return result.data;
};

const priceOf = (tick: number) => priceAtTick({ tick, ...DECIMALS }) ?? Number.NaN;

describe("calculateRangeOrders", () => {
  /*
   * The claim the whole panel rests on, checked against the protocol's formulas
   * rather than against itself. For liquidity `L` in `[pa, pb]` the position
   * holds `L · (1/√pa − 1/√pb)` of token0 below the band and `L · (√pb − √pa)`
   * of token1 above it; the second over the first is what the conversion
   * averaged. Written out here in full so that a module computing the mean of
   * the wrong pair — or the arithmetic mean — fails rather than agrees with
   * itself.
   */
  it.each([
    ["the selling leg", "above" as const],
    ["the buying leg", "below" as const],
  ])("prices %s at what the position's own amounts give", (_label, placement) => {
    const orders = succeed(7);
    const leg = orders[placement];
    if (leg === null) throw new Error("expected a leg");

    const amount0 = 1 / Math.sqrt(leg.lowerPrice) - 1 / Math.sqrt(leg.upperPrice);
    const amount1 = Math.sqrt(leg.upperPrice) - Math.sqrt(leg.lowerPrice);

    expect(leg.averagePrice).toBeCloseTo(amount1 / amount0, 12);
  });

  it("prices it the same whatever the position is worth", () => {
    const leg = succeed(7).above;
    if (leg === null) throw new Error("expected a leg");

    const averageFor = (liquidity: number) =>
      (liquidity * (Math.sqrt(leg.upperPrice) - Math.sqrt(leg.lowerPrice))) /
      (liquidity * (1 / Math.sqrt(leg.lowerPrice) - 1 / Math.sqrt(leg.upperPrice)));

    expect(averageFor(1)).toBeCloseTo(averageFor(1e9), 12);
    expect(leg.averagePrice).toBeCloseTo(averageFor(1e9), 12);
  });

  /*
   * The bucket the price sits in belongs to neither side. A leg that started at
   * the price's own bucket would already be in range, which is the one thing a
   * one-sided position is defined by not being.
   */
  it("splits at the bucket the price is in, on the pool's grid", () => {
    const orders = succeed(7);

    expect(orders.above?.lowerTick).toBe(60);
    expect(orders.above?.upperTick).toBe(1_200);
    expect(orders.below?.lowerTick).toBe(-1_200);
    expect(orders.below?.upperTick).toBe(0);
  });

  it("puts the split above the price even when the price sits on a boundary", () => {
    const orders = succeed(60);

    expect(orders.above?.lowerTick).toBe(120);
    expect(orders.below?.upperTick).toBe(60);
  });

  it("splits a negative tick on the same grid", () => {
    const orders = succeed(-7);

    expect(orders.above?.lowerTick).toBe(0);
    expect(orders.below?.upperTick).toBe(-60);
  });

  it("reads each leg's prices off the ticks it reports", () => {
    const leg = succeed(7).above;

    expect(leg?.lowerPrice).toBeCloseTo(priceOf(60), 15);
    expect(leg?.upperPrice).toBeCloseTo(priceOf(1_200), 15);
  });

  it("keeps the two legs apart", () => {
    const orders = succeed(7);

    expect(orders.below!.upperTick).toBeLessThanOrEqual(orders.above!.lowerTick);
    expect(orders.below!.averagePrice).toBeLessThan(orders.above!.averagePrice);
  });

  it("offers only the side with room when the range is against one edge", () => {
    const orders = succeed(7, -1_200, 60);

    expect(orders.above).toBeNull();
    expect(orders.below).not.toBeNull();
  });

  it("reports absence rather than nothing when neither side has room", () => {
    const result = calculateRangeOrders({ pool: pool(), range: range(7, 0, 60) });

    expect(result).toEqual({ status: "unavailable", notice: "range-order-no-room" });
  });

  /*
   * A spacing of zero is not a pool. The range above it could not have been
   * computed either — the same alignment is what produced its edges — so this
   * guards the function rather than the page.
   */
  it("refuses a spacing no pool can have", () => {
    const result = calculateRangeOrders({ pool: pool(0), range: range(7) });

    expect(result).toEqual({ status: "unavailable", notice: "range-order-unverifiable" });
  });
});
