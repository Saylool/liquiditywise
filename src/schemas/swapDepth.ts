import { z } from "zod";

import { PositivePriceSchema, TokenAmountSchema } from "./primitives";

/*
 * The largest swap this application can price exactly, in each direction, and
 * what that swap gives up against the price on the screen.
 *
 * Every other figure here is about providing liquidity. This one is about using
 * it, and it exists because nothing else on the page answers the first question
 * anybody asks of a pool: how much can I actually trade through it.
 *
 * **Why there is a largest.** A pool's liquidity is constant between initialized
 * ticks and changes only at them, and a tick can only be initialized at a
 * multiple of the pool's tick spacing. So between the two spacing boundaries the
 * current price sits between, the liquidity the page already read is the whole
 * truth, and a swap inside that span can be priced from the protocol's formulas
 * with nothing assumed. One boundary further and another position's liquidity
 * may begin or end — which is knowable, by reading the liquidity at every price,
 * and this application does not read it. So the figure stops where the certainty
 * does rather than being extended by a guess.
 *
 * **What it costs is the geometric mean again.** For constant liquidity `L`
 * moving the price from `P` to `p`:
 *
 *   amount0 = L · |1/√p − 1/√P|      amount1 = L · |√P − √p|
 *
 * and one over the other is `√(P · p)` — the same identity the range-order panel
 * rests on, from the same two formulas, seen from the other side of the trade.
 * A swap through a band pays the geometric mean of its ends; a one-sided
 * position sitting in that band receives it.
 *
 * **It is not the price of a swap anybody would make.** It is the price of the
 * largest one this page can be sure about, which on a deep pool is a lot of
 * money and on a quiet one is very little. That difference is the point: it is
 * the reason anybody spreads an order out rather than sending it at once.
 */

/** Which token goes in, which is what decides the direction the price moves. */
export const SwapDirectionSchema = z.enum(["token0", "token1"]);

export type SwapDirection = z.infer<typeof SwapDirectionSchema>;

const SwapLegObject = z.strictObject({
  tokenIn: SwapDirectionSchema,
  /** Whole tokens of the token going in, and of the one coming out. */
  amountIn: TokenAmountSchema,
  amountOut: TokenAmountSchema,
  /** The spacing boundary the swap walks the price to, in the pool's direction. */
  edgePrice: PositivePriceSchema,
  /** What the swap averages, in the pool's `token0PriceInToken1` direction. */
  averagePrice: PositivePriceSchema,
  /**
   * How far that average sits from the price on the screen, as a positive
   * fraction — always the way round that costs the swapper.
   *
   * One number for both directions on purpose. A reader comparing the two sides
   * of a pool is comparing what each costs, and a figure that changed sign
   * between them would have to be read twice.
   */
  costRatio: z.number().nonnegative(),
});

export const SwapLegSchema = SwapLegObject
  .refine((leg) => leg.amountIn > 0 && leg.amountOut > 0, {
    /* A leg with no room is absent rather than zero; see the calculator. */
    error: "A priced swap moves something in both directions.",
    path: ["amountIn"],
  })
  .refine(
    (leg) => Math.abs(leg.amountOut / leg.amountIn / rateOf(leg) - 1) < 1e-9,
    {
      /*
       * The one check that ties the amounts to the price. They come out of two
       * different brackets of the same formula, so a mistake in either shows up
       * here as a quotient that is not the average — and nowhere else.
       *
       * A part in a billion, which is nowhere near any mistake this could catch:
       * a swapped bracket is out by percent. What it is close to is the floating
       * point. Both brackets are differences of nearly equal numbers, so a step
       * one tick wide with the price almost on its boundary cancels most of the
       * available digits — measured at 1.2e-12 on a leg with room in it and
       * 4.6e-9 on one with two billionths of a token. The calculator drops the
       * leg this refuses rather than losing the other one, so the bound doing
       * double duty — checking the arithmetic and throwing out dust — is
       * deliberate.
       */
      error: "The amounts must divide into the average price.",
      path: ["averagePrice"],
    },
  );

/** What one over the other has to come to, in the direction the leg runs. */
const rateOf = (leg: z.infer<typeof SwapLegObject>): number =>
  leg.tokenIn === "token0" ? leg.averagePrice : 1 / leg.averagePrice;

export type SwapLeg = z.infer<typeof SwapLegSchema>;

export const SwapDepthSchema = z
  .strictObject({
    /** Selling token0 into the pool, which walks the price down. */
    sellingToken0: SwapLegSchema.nullable(),
    /** Selling token1, which walks it up. `null` when the price is on a boundary. */
    sellingToken1: SwapLegSchema.nullable(),
    /** The price both legs start from, carried so the page can state it once. */
    spotPrice: PositivePriceSchema,
  })
  .refine((depth) => depth.sellingToken0 !== null || depth.sellingToken1 !== null, {
    error: "At least one direction must have room to price a swap.",
    path: ["sellingToken0"],
  })
  .refine(
    (depth) =>
      (depth.sellingToken0 === null || depth.sellingToken0.edgePrice < depth.spotPrice) &&
      (depth.sellingToken1 === null || depth.sellingToken1.edgePrice > depth.spotPrice),
    {
      /* Selling token0 can only move the price down, and token1 only up. */
      error: "Each leg must walk the price the way its own direction moves it.",
      path: ["spotPrice"],
    },
  );

export type SwapDepth = z.infer<typeof SwapDepthSchema>;
