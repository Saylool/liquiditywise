import {
  type DataFailureNotice,
  type Pool,
  type RangeOrderLeg,
  type RangeOrders,
  RangeOrdersSchema,
  type TickRange,
} from "../../schemas";
import { alignTickDown, alignTickUp, priceAtTick } from "../uniswap/v3TickMath";

/*
 * The two one-sided positions the suggested range contains.
 *
 * Pure: no clock, no network, no environment, and no source of its own — every
 * number here comes from the range already on the page and the pool's own tick
 * grid. It is arithmetic the protocol fixes rather than a reading of anything.
 *
 * The range this page suggests is two-sided: it straddles the current price and
 * earns fees while the price stays inside it. Split at the price, each half is
 * something else — a position wholly on one side of the market, which the pool
 * converts from one token into the other as the price moves through it. The
 * halves are worth naming because they are the same range a reader is already
 * looking at, used for the other thing a position can do, and because the price
 * it converts at is knowable in advance and exactly.
 *
 * See {@link RangeOrdersSchema} for why that price is the geometric mean of the
 * bounds, and for what the figure does not promise.
 */

const NO_ROOM = "range-order-no-room";
const UNVERIFIABLE = "range-order-unverifiable";

export type RangeOrdersResult =
  | { readonly status: "success"; readonly data: RangeOrders }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type RangeOrdersInput = {
  /** For the tick grid and the decimals a tick's price depends on. */
  readonly pool: Pool;
  /** The range being suggested, which is what gets split at the current price. */
  readonly range: TickRange;
};

/**
 * One leg, from a pair of ticks, or `null` when they do not bound a position.
 *
 * `null` rather than a failure: a range narrow enough to leave no whole price
 * step on one side of the price is a range, not a broken one, and the side that
 * does have room is still worth showing.
 */
const leg = (
  placement: RangeOrderLeg["placement"],
  lowerTick: number,
  upperTick: number,
  token0Decimals: number,
  token1Decimals: number,
): RangeOrderLeg | null => {
  if (lowerTick >= upperTick) return null;

  const decimals = { token0Decimals, token1Decimals };
  const lowerPrice = priceAtTick({ tick: lowerTick, ...decimals });
  const upperPrice = priceAtTick({ tick: upperTick, ...decimals });
  if (lowerPrice === null || upperPrice === null) return null;

  return {
    placement,
    lowerTick,
    upperTick,
    lowerPrice,
    upperPrice,
    /*
     * `sqrt(a) * sqrt(b)` rather than `sqrt(a * b)`: the product of two prices
     * is the one quantity here that can overflow, and a pool of an
     * eighteen-decimal token against a two-decimal one puts real prices far
     * enough apart for it to matter. Taking the roots first halves both
     * exponents before they are ever multiplied.
     */
    averagePrice: Math.sqrt(lowerPrice) * Math.sqrt(upperPrice),
  };
};

/**
 * Splits the suggested range at the tick the price is in.
 *
 * The split is on the pool's grid rather than at the price itself, because a
 * position's bounds have to be multiples of the tick spacing and because a band
 * that merely started at the price would still contain it. The bucket the price
 * sits in belongs to neither side: the selling leg begins at the boundary above
 * it, and the buying leg ends at the boundary below it.
 */
export const calculateRangeOrders = ({ pool, range }: RangeOrdersInput): RangeOrdersResult => {
  const tickSpacing = pool.tickSpacing;
  const bucketStart = alignTickDown({ tick: range.currentTick, tickSpacing });
  if (bucketStart === null) return { status: "unavailable", notice: UNVERIFIABLE };

  /* The next boundary up. `+ 1` cannot already be on the grid, so this moves. */
  const bucketEnd = alignTickUp({ tick: bucketStart + 1, tickSpacing });
  if (bucketEnd === null) return { status: "unavailable", notice: UNVERIFIABLE };

  const decimals = [pool.token0.decimals, pool.token1.decimals] as const;
  const candidate = {
    above: leg("above", bucketEnd, range.upperTick, ...decimals),
    below: leg("below", range.lowerTick, bucketStart, ...decimals),
  };
  if (candidate.above === null && candidate.below === null) {
    return { status: "unavailable", notice: NO_ROOM };
  }

  const verified = RangeOrdersSchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: UNVERIFIABLE };

  return { status: "success", data: verified.data };
};
