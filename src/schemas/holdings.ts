import { z } from "zod";

import { DataSourceSchema } from "./dataSource";
import {
  IsoTimestampSchema,
  nonZeroEvmAddress,
  UnsignedIntegerStringSchema,
} from "./primitives";
import { V3PoolMetadataSchema, V3TokenSchema } from "./uniswap";

/*
 * What one address holds, and which pools those tokens can go into.
 *
 * The question this answers is the one a newcomer actually has. Every other page
 * here starts from a pool and assumes the reader knows which pool to ask about;
 * this one starts from what somebody already owns.
 *
 * **It is a search, not an inventory.** Nothing can enumerate what an address
 * holds: an ERC-20 balance lives in the token's own contract, so finding one
 * means knowing which contract to ask. So a candidate list is drawn from the
 * pools that have actually been traded, every one of those tokens is asked, and
 * the answer is honest about its own width — a token outside that list is not
 * reported as absent, it is simply not among the ones checked, and the interface
 * says how many were.
 *
 * **No amount here is money.** Balances are token amounts, in the token's own
 * units. Turning them into a portfolio value would need a price per token that
 * this application does not read, and would make a page about what to do with
 * what you have into a page about what it is worth.
 */

/**
 * The pools a holdings lookup draws its candidate tokens from.
 *
 * A net, not a ranking. The order is the source's own and nothing presents it as
 * a judgement; what this application adds is that every entry is a verified pool
 * contract, admitted on the same terms as one a reader searched for.
 */
export const PoolCandidateListSchema = z
  .strictObject({
    pools: z.array(V3PoolMetadataSchema).min(1, {
      error: "A candidate list with no pools in it can answer nothing.",
    }),
    fetchedAt: IsoTimestampSchema,
    source: DataSourceSchema.extract(["uniswap-v3-subgraph"]),
  })
  .refine(
    (list) => new Set(list.pools.map((pool) => pool.id)).size === list.pools.length,
    { error: "The same pool appears twice in one candidate list.", path: ["pools"] },
  );

export type PoolCandidateList = z.infer<typeof PoolCandidateListSchema>;

/** The only sources that can answer this: the pool list, then the chain itself. */
export const HoldingsSourceSchema = DataSourceSchema.extract([
  "uniswap-v3-subgraph",
  "ethereum-rpc",
]);

/**
 * How much of one token an address holds.
 *
 * The amount stays a base-unit integer string all the way to the formatter.
 * Eighteen decimals put an ordinary balance far past what a double represents
 * exactly, so a number here would round somebody's balance in the domain and
 * there would be nothing left to round back.
 */
export const TokenHoldingSchema = z.strictObject({
  token: V3TokenSchema,
  amount: UnsignedIntegerStringSchema.refine((amount) => amount !== "0", {
    error: "A zero balance is not a holding; leave it out instead.",
  }),
});

export type TokenHolding = z.infer<typeof TokenHoldingSchema>;

/** Which sides of a pool an address already has. */
export const HeldSidesSchema = z.enum(["both", "token0", "token1"]);

export type HeldSides = z.infer<typeof HeldSidesSchema>;

export const HoldingPoolSchema = z.strictObject({
  pool: V3PoolMetadataSchema,
  /**
   * Carried rather than left to the page to work out, and re-derived below from
   * the holdings themselves. It is the only claim this list makes, and a pool
   * marked "both" that the reader can only half enter is the kind of wrong that
   * looks right.
   */
  heldSides: HeldSidesSchema,
});

export type HoldingPool = z.infer<typeof HoldingPoolSchema>;

type HoldingsShape = {
  readonly holdings: readonly TokenHolding[];
  readonly pools: readonly HoldingPool[];
  readonly tokensChecked: number;
};

const heldAddresses = (check: HoldingsShape): ReadonlySet<string> =>
  new Set(check.holdings.map((holding) => holding.token.address));

/** No token may appear twice; one balance per contract. */
const holdingsAreDistinct = (check: HoldingsShape): boolean =>
  heldAddresses(check).size === check.holdings.length;

/** Nor may a pool, which would offer the same market twice. */
const poolsAreDistinct = (check: HoldingsShape): boolean =>
  new Set(check.pools.map((entry) => entry.pool.id)).size === check.pools.length;

/**
 * Every pool listed is one the address can actually put something into, and the
 * side it is marked with is the side it holds.
 *
 * Re-derived from the holdings rather than believed, like every other claim this
 * application publishes. A pool whose tokens are neither held has no business on
 * the page at all; one marked "both" that is really half is worse, because it
 * reads as ready.
 */
const sidesFollowFromHoldings = (check: HoldingsShape): boolean => {
  const held = heldAddresses(check);

  return check.pools.every((entry) => {
    const hasToken0 = held.has(entry.pool.token0.address);
    const hasToken1 = held.has(entry.pool.token1.address);
    const actual = hasToken0 && hasToken1 ? "both" : hasToken0 ? "token0" : hasToken1 ? "token1" : null;

    return actual === entry.heldSides;
  });
};

/**
 * Pools whose two sides are both held come first.
 *
 * The one ordering claim, and it is about the *reader* rather than about the
 * pools: a pool you already hold both sides of is one you can enter without
 * swapping anything first. Within each group the order is the one the pool list
 * arrived in, which the interface names.
 */
const bothSidesComeFirst = (check: HoldingsShape): boolean => {
  const lastBoth = check.pools.reduce(
    (last, entry, index) => (entry.heldSides === "both" ? index : last),
    -1,
  );

  return check.pools.every((entry, index) => index > lastBoth || entry.heldSides === "both");
};

/** A list can only report what it looked at, never more. */
const noMoreHoldingsThanTokensChecked = (check: HoldingsShape): boolean =>
  check.holdings.length <= check.tokensChecked;

export const AddressHoldingsSchema = z
  .strictObject({
    /** Whose holdings these are. Public data, and never stored. */
    address: nonZeroEvmAddress("The zero address holds nothing anyone can act on."),
    /**
     * How many distinct token contracts were asked.
     *
     * On the page beside the answer, because it is the width of the net. A
     * reader who holds something outside it should be able to see that the
     * question asked was narrower than "what do you own".
     */
    tokensChecked: z.int().min(1),
    holdings: z.array(TokenHoldingSchema),
    pools: z.array(HoldingPoolSchema),
    /** When this application asked. A balance is a reading, not a fact. */
    fetchedAt: IsoTimestampSchema,
    sources: z.array(HoldingsSourceSchema).min(1),
  })
  .refine(holdingsAreDistinct, {
    error: "The same token appears twice in one set of holdings.",
    path: ["holdings"],
  })
  .refine(poolsAreDistinct, {
    error: "The same pool appears twice in one list.",
    path: ["pools"],
  })
  .refine(noMoreHoldingsThanTokensChecked, {
    error: "More tokens were reported held than were checked.",
    path: ["holdings"],
  })
  .refine(sidesFollowFromHoldings, {
    error: "A pool's held sides must follow from the holdings beside it.",
    path: ["pools"],
  })
  .refine(bothSidesComeFirst, {
    error: "Pools with both sides held must come before the rest.",
    path: ["pools"],
  });

export type AddressHoldings = z.infer<typeof AddressHoldingsSchema>;
