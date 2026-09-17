import { describe, expect, it } from "vitest";

import type { Pool, PoolMarketSnapshot, TickRange } from "../../schemas";
import { priceAtTick } from "../uniswap/v3TickMath";
import { calculateSwapDepth } from "./swapDepth";

/*
 * Eighteen decimals on both sides puts the scale at 1e18, so a liquidity of
 * 1e18 is exactly one token's worth and every amount below can be read. Spacing
 * 60 and a current tick of 7 put the price in the step from tick 0 to tick 60 —
 * prices 1 and 1.0060…, with the spot deliberately off-centre inside it.
 */
const TICK_SPACING = 60;
const DECIMALS = { token0Decimals: 18, token1Decimals: 18 };
const SPOT = 1.003;
const LIQUIDITY = "1000000000000000000";

const priceOf = (tick: number) => priceAtTick({ tick, ...DECIMALS }) ?? Number.NaN;

const pool = (tickSpacing = TICK_SPACING, decimals = 18): Pool =>
  ({
    tickSpacing,
    token0: { decimals, symbol: "AAA" },
    token1: { decimals: 18, symbol: "BBB" },
  }) as unknown as Pool;

const snapshot = (overrides: Partial<PoolMarketSnapshot> = {}): PoolMarketSnapshot =>
  ({ liquidity: LIQUIDITY, tick: 7, ...overrides }) as unknown as PoolMarketSnapshot;

const range = (currentTick = 7, currentPrice = SPOT): TickRange =>
  ({ currentTick, band: { currentPrice } }) as unknown as TickRange;

const succeed = (input: Partial<Parameters<typeof calculateSwapDepth>[0]> = {}) => {
  const result = calculateSwapDepth({
    pool: pool(),
    snapshot: snapshot(),
    range: range(),
    ...input,
  });
  if (result.status === "unavailable") throw new Error(`expected a figure: ${result.notice}`);
  return result.data;
};

describe("calculateSwapDepth", () => {
  /*
   * Written out from the protocol's two brackets rather than taken from the
   * module, so a swapped sign or a swapped bracket fails here instead of
   * agreeing with itself.
   */
  it("prices a sale of token0 at what the position formulas give", () => {
    const leg = succeed().sellingToken0;
    if (leg === null) throw new Error("expected a leg");

    const rootSpot = Math.sqrt(SPOT);
    const rootEdge = Math.sqrt(priceOf(0));

    expect(leg.amountIn).toBeCloseTo(1 / rootEdge - 1 / rootSpot, 15);
    expect(leg.amountOut).toBeCloseTo(rootSpot - rootEdge, 15);
    expect(leg.edgePrice).toBeCloseTo(priceOf(0), 15);
  });

  it("prices a sale of token1 the other way round", () => {
    const leg = succeed().sellingToken1;
    if (leg === null) throw new Error("expected a leg");

    const rootSpot = Math.sqrt(SPOT);
    const rootEdge = Math.sqrt(priceOf(TICK_SPACING));

    expect(leg.amountIn).toBeCloseTo(rootEdge - rootSpot, 15);
    expect(leg.amountOut).toBeCloseTo(1 / rootSpot - 1 / rootEdge, 15);
    expect(leg.edgePrice).toBeCloseTo(priceOf(TICK_SPACING), 15);
  });

  /* The identity the range-order panel rests on, from the other side. */
  it("averages the geometric mean of the price now and the price it ends at", () => {
    const depth = succeed();

    for (const leg of [depth.sellingToken0, depth.sellingToken1]) {
      if (leg === null) continue;
      expect(leg.averagePrice).toBeCloseTo(
        Math.exp((Math.log(SPOT) + Math.log(leg.edgePrice)) / 2),
        15,
      );
    }
  });

  it("makes the amounts divide into that average", () => {
    const depth = succeed();
    const sell0 = depth.sellingToken0;
    const sell1 = depth.sellingToken1;
    if (sell0 === null || sell1 === null) throw new Error("expected both legs");

    expect(sell0.amountOut / sell0.amountIn).toBeCloseTo(sell0.averagePrice, 12);
    expect(sell1.amountOut / sell1.amountIn).toBeCloseTo(1 / sell1.averagePrice, 12);
  });

  it("charges each direction the distance from the spot, always positively", () => {
    const depth = succeed();

    expect(depth.sellingToken0?.costRatio).toBeCloseTo(
      1 - (depth.sellingToken0?.averagePrice ?? 0) / SPOT,
      15,
    );
    expect(depth.sellingToken1?.costRatio).toBeCloseTo(
      (depth.sellingToken1?.averagePrice ?? 0) / SPOT - 1,
      15,
    );
    expect(depth.sellingToken0?.costRatio).toBeGreaterThan(0);
    expect(depth.sellingToken1?.costRatio).toBeGreaterThan(0);
  });

  /*
   * The scale between the protocol's L and whole tokens, which is where a wrong
   * power of ten leaves a positive, finite, wildly wrong number.
   *
   * Changing token0 from eighteen decimals to six changes what a tick encodes,
   * so the spot has to move with it — a price a thousandth of the way into the
   * same step, twelve orders of magnitude down. Then each token's amount should
   * follow its *own* decimals: token0's grows by 1e12, and token1's does not
   * move at all, because nothing about token1 changed.
   */
  it("turns liquidity into whole tokens through each token's own decimals", () => {
    const spotFor = (token0Decimals: number) => SPOT * 10 ** -(18 - token0Decimals);
    const wide = succeed({ range: range(7, spotFor(18)) });
    const narrow = succeed({
      pool: pool(TICK_SPACING, 6),
      range: range(7, spotFor(6)),
    });

    /* Compared as ratios: the two runs are twelve orders of magnitude apart, and
     * an absolute tolerance would be meaningless across that. */
    const grew = (narrow.sellingToken0?.amountIn ?? 0) / (wide.sellingToken0?.amountIn ?? 1);
    const moved = (narrow.sellingToken0?.amountOut ?? 0) / (wide.sellingToken0?.amountOut ?? 1);

    expect(grew / 1e12).toBeCloseTo(1, 9);
    expect(moved).toBeCloseTo(1, 9);
  });

  it("costs more on a pool whose price steps are wider", () => {
    const fine = succeed();
    const coarse = succeed({ pool: pool(200) });

    expect(coarse.sellingToken1?.amountIn).toBeGreaterThan(fine.sellingToken1?.amountIn ?? 0);
    expect(coarse.sellingToken1?.costRatio).toBeGreaterThan(fine.sellingToken1?.costRatio ?? 0);
  });

  /*
   * A leg with billionths of a token in it is not a swap, and its amounts are
   * differences of nearly equal numbers — so the check that ties them to the
   * price is what throws it out. The other direction has a whole step of room
   * and must survive it.
   */
  it("drops a direction whose room is a rounding error, and keeps the other", () => {
    const edge = priceOf(TICK_SPACING);
    const depth = succeed({ range: range(TICK_SPACING - 1, edge * (1 - 1e-9)) });

    expect(depth.sellingToken1).toBeNull();
    expect(depth.sellingToken0).not.toBeNull();
    expect(depth.sellingToken0?.amountIn).toBeGreaterThan(0);
  });

  it("leaves out a direction the price has no room in", () => {
    const depth = succeed({ range: range(0, priceOf(0)) });

    expect(depth.sellingToken0).toBeNull();
    expect(depth.sellingToken1).not.toBeNull();
  });

  /*
   * The liquidity belongs to whichever step the pool is actually in. Pricing a
   * swap across a step it may not be in is the one mistake here that produces a
   * perfectly reasonable-looking number.
   */
  it("refuses when the source's tick is in another step", () => {
    const result = calculateSwapDepth({
      pool: pool(),
      snapshot: snapshot({ tick: 120 }),
      range: range(),
    });

    expect(result).toEqual({ status: "unavailable", notice: "swap-depth-tick-disagreement" });
  });

  /*
   * The window the guard actually covers. `calculateTickRange` refuses anything
   * more than one tick apart before this runs, so the reachable case is a price
   * sitting on a spacing boundary with the source's tick one below it.
   */
  it("refuses a one-tick disagreement across a boundary", () => {
    const result = calculateSwapDepth({
      pool: pool(),
      snapshot: snapshot({ tick: 59 }),
      range: range(60, priceOf(60) * 1.000_01),
    });

    expect(result).toEqual({ status: "unavailable", notice: "swap-depth-tick-disagreement" });
  });

  it("accepts a source tick elsewhere in the same step", () => {
    expect(succeed({ snapshot: snapshot({ tick: 59 }) }).sellingToken0).not.toBeNull();
  });

  it("accepts a source that reported no tick at all", () => {
    expect(succeed({ snapshot: snapshot({ tick: null }) }).sellingToken0).not.toBeNull();
  });

  it("reports absence when there is no liquidity at the price", () => {
    const result = calculateSwapDepth({
      pool: pool(),
      snapshot: snapshot({ liquidity: "0" }),
      range: range(),
    });

    expect(result).toEqual({ status: "unavailable", notice: "swap-depth-no-liquidity" });
  });

  it("refuses a spacing no pool can have", () => {
    const result = calculateSwapDepth({
      pool: pool(0),
      snapshot: snapshot(),
      range: range(),
    });

    expect(result).toEqual({ status: "unavailable", notice: "swap-depth-unverifiable" });
  });
});
