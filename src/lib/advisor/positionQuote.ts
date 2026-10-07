import { MAX_TICK, MIN_TICK, type Position, V3_MAX_TICK_SPACING } from "../../schemas";
import { choosePriceQuote, type PriceQuote } from "../format/priceQuote";

/*
 * How a listed position is quoted, shared by the two places that write one
 * out: the row on the holdings page and the card that row offers to share.
 * A card that quoted a range the other way round from the page it was made
 * on would show the same position as two different things.
 *
 * Pure: arithmetic on a position's own ticks and prices, nothing read.
 */

/**
 * The price a position's quote direction is chosen from: the middle of its
 * own band, so a range never comes out upside down for want of a tick.
 */
export const referencePrice = (position: Position): number =>
  Math.sqrt(position.lowerPrice) * Math.sqrt(position.upperPrice);

/**
 * Each position is quoted the way the rest of the application quotes a pair:
 * one direction chosen from the price, the dearer token as the base.
 */
export const positionQuote = (position: Position): PriceQuote => choosePriceQuote(position.pool, referencePrice(position));

/**
 * Whether a position covers every price its pool can express.
 *
 * A deliberate and common choice, and one the page was printing as
 * `2.96E-39 – 3.38E38`, which is true and tells a reader nothing.
 *
 * A v4 position carries its pool's tick spacing, so the outermost usable ticks
 * are exact: they are the last multiples of the spacing inside TickMath's
 * limits, and no tick between one of those and the limit exists. A v3 position
 * does not — no subgraph publishes a pool's spacing, and the metadata behind
 * these stops short of it — so there the test is "beyond anything any pool could
 * offer" rather than "exactly the edge".
 */
export const coversEveryPrice = (position: Position): boolean => {
  const spacing = position.pool.protocolVersion === "v4" ? position.pool.tickSpacing : V3_MAX_TICK_SPACING;

  return position.tickLower <= MIN_TICK + spacing && position.tickUpper >= MAX_TICK - spacing;
};
