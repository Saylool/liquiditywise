import { describe, expect, it } from "vitest";

import type { Token } from "../../schemas";
import {
  choosePriceQuote,
  edgeDistances,
  heldAboveRange,
  heldBelowRange,
  quotedEnds,
  quotedInterval,
  quotedPrice,
} from "./priceQuote";

const USDC: Token = { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 };
const WETH: Token = { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 };
const pair = { token0: USDC, token1: WETH };

describe("choosePriceQuote", () => {
  /* The pool quotes ether in dollars: 0.000293 WETH per USDC. A reader is told the reverse. */
  it("prices the dearer token in the cheaper one when the pool's own price is below one", () => {
    const quote = choosePriceQuote(pair, 1 / 3412);

    expect(quote.base).toBe(WETH);
    expect(quote.quote).toBe(USDC);
    expect(quote.inverted).toBe(true);
  });

  it("keeps the pool's own direction when its price is above one", () => {
    const quote = choosePriceQuote(pair, 3412);

    expect(quote.base).toBe(USDC);
    expect(quote.quote).toBe(WETH);
    expect(quote.inverted).toBe(false);
  });

  it("does not flip a pair at exactly parity", () => {
    expect(choosePriceQuote(pair, 1).inverted).toBe(false);
  });

  /* The rule is the price, not the symbols: swapped names change nothing. */
  it("reads the price and not the symbols", () => {
    const swapped = { token0: WETH, token1: USDC };

    expect(choosePriceQuote(swapped, 3412).base).toBe(WETH);
    expect(choosePriceQuote(swapped, 1 / 3412).base).toBe(USDC);
  });
});

describe("quotedPrice", () => {
  it("returns the reciprocal when inverted and the figure itself when not", () => {
    expect(quotedPrice(choosePriceQuote(pair, 1 / 3412), 1 / 3412)).toBeCloseTo(3412, 9);
    expect(quotedPrice(choosePriceQuote(pair, 3412), 3412)).toBe(3412);
  });
});

describe("quotedInterval", () => {
  const inverted = choosePriceQuote(pair, 1 / 3412);
  const upright = choosePriceQuote(pair, 3412);

  /* The reciprocal of the higher price is the lower one, so the ends trade places. */
  it("swaps the ends when inverting", () => {
    const interval = quotedInterval(inverted, { lower: 1 / 3700, upper: 1 / 3150 });

    expect(interval.lower).toBeCloseTo(3150, 9);
    expect(interval.upper).toBeCloseTo(3700, 9);
  });

  it("keeps the interval as it is when not inverting", () => {
    expect(quotedInterval(upright, { lower: 3150, upper: 3700 })).toEqual({
      lower: 3150,
      upper: 3700,
    });
  });

  it("never produces a lower end above the upper", () => {
    for (const [lower, upper] of [
      [1e-31, 1e-3],
      [0.5, 2],
      [1 / 3700, 1 / 3150],
    ] as const) {
      const shown = quotedInterval(inverted, { lower, upper });
      expect(shown.lower).toBeLessThan(shown.upper);
    }
  });
});

/*
 * A truncation flag names an edge, and inverting the quote renames the edges:
 * the pool's price can go no higher exactly where the reader's can go no lower.
 */
describe("quotedEnds", () => {
  it("swaps whatever is stated per edge when inverting", () => {
    const inverted = choosePriceQuote(pair, 1 / 3412);

    expect(quotedEnds(inverted, { lower: false, upper: true })).toEqual({ lower: true, upper: false });
    expect(quotedEnds(inverted, { lower: "a", upper: "b" })).toEqual({ lower: "b", upper: "a" });
  });

  it("leaves the ends alone when not inverting", () => {
    const upright = choosePriceQuote(pair, 3412);

    expect(quotedEnds(upright, { lower: false, upper: true })).toEqual({ lower: false, upper: true });
  });
});

describe("edgeDistances", () => {
  it("measures each edge from the current price, as a ratio of it", () => {
    const distances = edgeDistances(3412, { lower: 3150, upper: 3700 });

    expect(distances.down).toBeCloseTo(1 - 3150 / 3412, 12);
    expect(distances.up).toBeCloseTo(3700 / 3412 - 1, 12);
  });

  /*
   * Ten percent up in one direction is nine percent down in the other, so an
   * edge's distance changes with the direction it is read in. The interval
   * here is deliberately lopsided in log space — a tick-aligned range usually
   * is, its two edges having snapped outward by different amounts — because a
   * band symmetric in log space inverts onto itself and would pass this test
   * with the distances simply carried over.
   */
  it("differs from the pool-direction distances once the quote is inverted", () => {
    const current = 1 / 3412;
    const lower = current / 1.2;
    const upper = current * 1.1;
    const pool = edgeDistances(current, { lower, upper });

    const inverted = choosePriceQuote(pair, current);
    const shown = edgeDistances(
      quotedPrice(inverted, current),
      quotedInterval(inverted, { lower, upper }),
    );

    expect(pool.down).toBeCloseTo(1 - 1 / 1.2, 12);
    expect(pool.up).toBeCloseTo(0.1, 12);
    expect(shown.down).toBeCloseTo(1 - 1 / 1.1, 12);
    expect(shown.up).toBeCloseTo(0.2, 12);
  });

  it("reports a negative distance for an edge the price has already passed", () => {
    expect(edgeDistances(3000, { lower: 3150, upper: 3700 }).down).toBeLessThan(0);
  });
});

/*
 * Fixed by the protocol in the pool's direction — below the range only token0,
 * above it only token1 — and stated here in the shown direction, where the two
 * inversions cancel: the position finishes in the base as the base gets
 * cheaper, and in the quote as the base gets dearer.
 */
describe("what a position holds beyond each edge", () => {
  it("holds only ether when ether falls out of the bottom of the range", () => {
    const quote = choosePriceQuote(pair, 1 / 3412);

    expect(heldBelowRange(quote)).toBe(WETH);
    expect(heldAboveRange(quote)).toBe(USDC);
  });

  it("holds only token0 below the range in the pool's own direction", () => {
    const quote = choosePriceQuote(pair, 3412);

    expect(heldBelowRange(quote)).toBe(USDC);
    expect(heldAboveRange(quote)).toBe(WETH);
  });
});
