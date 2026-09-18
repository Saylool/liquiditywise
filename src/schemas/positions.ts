import { z } from "zod";

import { HoldingsSourceSchema } from "./holdings";
import {
  EvmAddressSchema,
  IsoTimestampSchema,
  PositivePriceSchema,
  Uint128StringSchema,
  UnsignedIntegerStringSchema,
} from "./primitives";
import { TickSchema, V3PoolMetadataSchema } from "./uniswap";

/*
 * The Uniswap v3 positions one address actually holds.
 *
 * Every other answer about an address here is about what it *could* do — which
 * pools the tokens it holds can be put into. This is what it has already done,
 * and it is the only figure in this application that describes somebody's own
 * money rather than a pool's.
 *
 * It is public. A position is an ERC-721 token, its owner is on chain, and
 * anybody can read the same list for the same address. Nothing is stored here
 * and nothing is remembered between visits.
 *
 * **A position names a pair and a fee, never a pool.** The pool is derived from
 * those by CREATE2 and then *checked*: the derived address is looked up, and a
 * pool that does not come back describing the same two tokens and the same fee
 * is dropped rather than shown. That check is why deriving is safe at all.
 */

/** How many positions the page lists before it counts the rest instead. */
export const POSITIONS_SHOWN = 12;

const V3PositionObject = z.strictObject({
  /** The NFT's id, as an exact decimal string: it is a uint256. */
  tokenId: UnsignedIntegerStringSchema,
  /** The pool it is in, as the source describes the address that was derived. */
  pool: V3PoolMetadataSchema,
  tickLower: TickSchema,
  tickUpper: TickSchema,
  /** What those ticks encode, in the pool's `token0PriceInToken1` direction. */
  lowerPrice: PositivePriceSchema,
  upperPrice: PositivePriceSchema,
  /** The protocol's L for this position. Never zero: a closed one is not listed. */
  liquidity: Uint128StringSchema,
  /** Where the pool is now, or `null` when the source reported no tick. */
  currentTick: TickSchema.nullable(),
  /**
   * Whether the pool's price is inside this position's range — which decides
   * whether it is earning anything at all. `null` when the tick is unread,
   * because "not earning" and "not known" are different things to be told.
   */
  inRange: z.boolean().nullable(),
});

export const V3PositionSchema = V3PositionObject
  .refine((position) => position.tickLower < position.tickUpper, {
    error: "A position's lower tick must sit below its upper tick.",
    path: ["tickUpper"],
  })
  .refine((position) => position.lowerPrice < position.upperPrice, {
    error: "A position's lower price must sit below its upper price.",
    path: ["upperPrice"],
  })
  .refine((position) => position.liquidity !== "0", {
    error: "A position with no liquidity left in it is a receipt, not a position.",
    path: ["liquidity"],
  })
  .refine(
    (position) =>
      position.currentTick === null
        ? position.inRange === null
        : position.inRange ===
          (position.currentTick >= position.tickLower && position.currentTick < position.tickUpper),
    {
      /*
       * Uniswap's own rule, and the one figure here a reader would act on: a
       * position earns while the pool's tick is at or above its lower bound and
       * strictly below its upper one. Deriving it in two places would let the
       * page say "in range" beside a range the price has left.
       */
      error: "Whether a position is in range must follow from the ticks beside it.",
      path: ["inRange"],
    },
  );

export type V3Position = z.infer<typeof V3PositionSchema>;

export const AddressPositionsSchema = z
  .strictObject({
    address: EvmAddressSchema,
    /** The open ones, newest place in the owner's list first, capped for display. */
    positions: z.array(V3PositionSchema).max(POSITIONS_SHOWN),
    /** Every position token the address holds, open and closed together. */
    held: z.int().nonnegative(),
    /** How many of those were asked about: `held`, unless it is past the ceiling. */
    read: z.int().nonnegative(),
    /** How many of the ones read still have liquidity in them. */
    open: z.int().nonnegative(),
    /** And how many had been closed. A minted-and-burnt token is not a position. */
    closed: z.int().nonnegative(),
    fetchedAt: IsoTimestampSchema,
    sources: z.array(HoldingsSourceSchema).min(1),
  })
  .refine((answer) => answer.read <= answer.held, {
    error: "No more positions can be read than the address holds.",
    path: ["read"],
  })
  .refine((answer) => answer.positions.length <= answer.open, {
    error: "No more positions can be listed than were found open.",
    path: ["positions"],
  })
  .refine((answer) => answer.open + answer.closed <= answer.read, {
    /*
     * Open and closed do not have to add up to what was read — a position whose
     * call reverted between two round trips is neither — but they can never
     * exceed it. A total that did would mean one answer was counted twice.
     */
    error: "Open and closed positions cannot outnumber the ones read.",
    path: ["open"],
  });

export type AddressPositions = z.infer<typeof AddressPositionsSchema>;
