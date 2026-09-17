import { z } from "zod";

import { PositivePriceSchema } from "./primitives";
import { TickSchema } from "./uniswap";

/*
 * A position on one side of the price, which converts one token into the other
 * as the price moves through it.
 *
 * Every other figure in this application describes a two-sided position: money
 * on both sides of the current price, earning fees while the price stays
 * between them. A one-sided position is the same instrument used for something
 * else entirely. Placed wholly above the price it holds only token0, and the
 * pool sells that token0 for token1 as the price rises through the band; placed
 * wholly below it holds only token1 and buys with it on the way down. It is the
 * thing people mean by a range order, and it was on this application's own list
 * of what it could not do.
 *
 * **The average price is exact and does not depend on how much is put in.** For
 * liquidity `L` in `[pa, pb]`, the amounts at the two ends are
 *
 *   amount0 (at or below pa) = L · (1/√pa − 1/√pb)
 *   amount1 (at or above pb) = L · (√pb − √pa)
 *
 * so the second over the first is
 *
 *   (√pb − √pa) / ((√pb − √pa) / (√pa·√pb)) = √(pa · pb)
 *
 * — the geometric mean of the bounds, with `L` cancelled out of it. Nothing
 * here is a forecast or an estimate: it is what the protocol's own formulas
 * give, and it is the same figure whichever way round the prices are written,
 * because the geometric mean of two reciprocals is the reciprocal of theirs.
 *
 * **It is an average, and only if the price goes all the way through.** A price
 * that turns back inside the band leaves the position holding some of each, at
 * no single price at all. Nothing schedules the conversion and nothing
 * guarantees it: this is not an order book, and an order that never fills is
 * the ordinary case rather than a failure.
 */

/** Which side of the current price a leg sits on, in the pool's own direction. */
export const RANGE_ORDER_PLACEMENTS = ["above", "below"] as const;

export const RangeOrderPlacementSchema = z.enum(RANGE_ORDER_PLACEMENTS);

export type RangeOrderPlacement = z.infer<typeof RangeOrderPlacementSchema>;

const RangeOrderLegObject = z.strictObject({
  placement: RangeOrderPlacementSchema,
  /** Both on the pool's tick grid: a position cannot be opened anywhere else. */
  lowerTick: TickSchema,
  upperTick: TickSchema,
  /** What those ticks encode, in the pool's `token0PriceInToken1` direction. */
  lowerPrice: PositivePriceSchema,
  upperPrice: PositivePriceSchema,
  /** The geometric mean of the two, which is what the conversion averages. */
  averagePrice: PositivePriceSchema,
});

export const RangeOrderLegSchema = RangeOrderLegObject
  .refine((leg) => leg.lowerTick < leg.upperTick, {
    error: "A leg's lower tick must sit below its upper tick.",
    path: ["upperTick"],
  })
  .refine((leg) => leg.lowerPrice < leg.upperPrice, {
    error: "A leg's lower price must sit below its upper price.",
    path: ["upperPrice"],
  })
  /*
   * The geometric mean of two distinct positive numbers lies strictly between
   * them. Checking it here is what would catch an average computed from the
   * wrong pair of bounds — which would still be a positive price, and would
   * still look like one on the page.
   */
  .refine((leg) => leg.lowerPrice < leg.averagePrice && leg.averagePrice < leg.upperPrice, {
    error: "A leg's average price must lie strictly between its bounds.",
    path: ["averagePrice"],
  });

export type RangeOrderLeg = z.infer<typeof RangeOrderLegSchema>;

export const RangeOrdersSchema = z
  .strictObject({
    /** Sells token0 as the price rises through it. `null` when there is no room. */
    above: RangeOrderLegSchema.nullable(),
    /** Buys token0 as the price falls through it. `null` when there is no room. */
    below: RangeOrderLegSchema.nullable(),
  })
  .refine((orders) => orders.above !== null || orders.below !== null, {
    /* With neither there is nothing to describe, and the caller says so instead. */
    error: "At least one side must have room for a leg.",
    path: ["above"],
  })
  .refine(
    (orders) =>
      orders.above === null ||
      orders.below === null ||
      orders.below.upperTick <= orders.above.lowerTick,
    {
      /* They sit on opposite sides of one price, so they cannot overlap. */
      error: "The two legs must not overlap.",
      path: ["below"],
    },
  );

export type RangeOrders = z.infer<typeof RangeOrdersSchema>;
