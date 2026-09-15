import { z } from "zod";

import { DataSourceSchema } from "./dataSource";
import { countExactSymbolMatches } from "./poolSearch";
import { IsoTimestampSchema, Uint128StringSchema, UnsignedIntegerStringSchema } from "./primitives";
import { PoolSearchTermsSchema } from "./searchTerms";
import { V4PoolSchema } from "./uniswap";

/*
 * What a v4 pool search is allowed to return.
 *
 * The same discipline as the v3 search beside it — the order is a claim, and it
 * is checked here rather than assumed — with one difference that the protocol
 * forces. A v3 pool is a contract, and what it holds can be asked of the token
 * contracts themselves. A v4 pool is an entry inside one PoolManager that holds
 * every pool's tokens together, so "what does this pool hold" has no address to
 * ask and no answer on chain. What the chain *does* hold, per pool, is the
 * pool's active liquidity and its price, and those are what this list is ordered
 * by.
 */

/** How many v4 pools one search returns. The v3 figure, for the same reasons. */
export const V4_POOL_SEARCH_RESULT_LIMIT = 12;

/** The only source that can answer a v4 pool search. */
export const V4PoolSearchSourceSchema = DataSourceSchema.extract(["uniswap-v4-subgraph"]);

/**
 * A square-root price in Q64.96, as the PoolManager stores it.
 *
 * Positive rather than merely unsigned: an initialised pool's price is never
 * zero, so a zero here is a slot that was never written — a pool that does not
 * exist — and it must not be carried as a price.
 */
const SqrtPriceX96Schema = UnsignedIntegerStringSchema.refine(
  (value) => BigInt(value) > 0n && BigInt(value) < 1n << 160n,
  { error: "A square-root price is a positive 160-bit integer." },
);

export const V4PoolSearchMatchSchema = z.strictObject({
  /**
   * The whole pool, invariants included. A v4 list entry can carry everything a
   * v4 pool is, because everything a v4 pool is comes back in one query.
   */
  pool: V4PoolSchema,
  /**
   * The pool's active liquidity and price, read from the PoolManager's own
   * storage rather than taken from the indexer.
   *
   * Read from the chain for the reason the v3 list reads balances from token
   * contracts: the indexer's figure was checked and found wrong. Its stored
   * liquidity matched the chain on 23 of 24 of the busiest pools and was
   * fifteen percent off on the twenty-fourth, and a list ordered by it would
   * put that pool in the wrong place with nothing on the page to show it.
   *
   * `null` when the chain could not be read, which is not an empty pool.
   */
  state: z
    .strictObject({
      liquidity: Uint128StringSchema,
      sqrtPriceX96: SqrtPriceX96Schema,
    })
    .nullable(),
  /** What one of each token is worth in ether, as the source derives it. */
  ethPrice: z
    .strictObject({
      token0: z.number().min(0),
      token1: z.number().min(0),
    })
    .nullable(),
  /** How many sides carry exactly one of the terms. Re-derived below, never trusted. */
  exactSymbolMatches: z.int().min(0).max(2),
});

export type V4PoolSearchMatch = z.infer<typeof V4PoolSearchMatchSchema>;

const Q96 = 1n << 96n;

/**
 * What a pool's active liquidity is worth at its current price, in ether, or
 * `null` when it cannot be known.
 *
 * The figure is the pool's *virtual reserves*: the two amounts a constant-product
 * pool with the same depth at this price would hold, `L / √P` of token0 and
 * `L · √P` of token1. It is the standard measure of how much a swap can draw on
 * here, it is exact arithmetic over two numbers read from the chain, and it is
 * deliberately not called "holds" anywhere — concentrated liquidity means a
 * pool's real balances are usually far smaller, and nothing on chain reports
 * them per pool.
 *
 * Exported for the same reason as the v3 list's `heldInEth`: the adapter that
 * orders the list and the schema that checks the order must use one number.
 * Base units are divided out here, where the decimals are in hand. Precision
 * past a double is irrelevant to a ranking key, and the figure is shown only to
 * a few significant digits.
 */
export const depthInEth = (match: {
  readonly pool: {
    readonly token0: { readonly decimals: number };
    readonly token1: { readonly decimals: number };
  };
  readonly state: { readonly liquidity: string; readonly sqrtPriceX96: string } | null;
  readonly ethPrice: { readonly token0: number; readonly token1: number } | null;
}): number | null => {
  if (match.state === null || match.ethPrice === null) return null;

  const liquidity = BigInt(match.state.liquidity);
  const sqrtPrice = BigInt(match.state.sqrtPriceX96);
  const token0Units = (liquidity * Q96) / sqrtPrice;
  const token1Units = (liquidity * sqrtPrice) / Q96;

  const value =
    (Number(token0Units) / 10 ** match.pool.token0.decimals) * match.ethPrice.token0 +
    (Number(token1Units) / 10 ** match.pool.token1.decimals) * match.ethPrice.token1;

  return Number.isFinite(value) ? value : null;
};

type ResultsShape = {
  readonly terms: readonly string[];
  readonly matches: readonly V4PoolSearchMatch[];
};

const matchesAreDistinct = ({ matches }: ResultsShape): boolean =>
  new Set(matches.map((match) => match.pool.id)).size === matches.length;

const scoresAreCorrect = ({ terms, matches }: ResultsShape): boolean =>
  matches.every(
    (match) =>
      match.exactSymbolMatches ===
      countExactSymbolMatches(terms, [match.pool.token0.symbol, match.pool.token1.symbol]),
  );

/**
 * Exact symbol matches first, then depth, then — for pools the chain could not
 * be read for — last. The same shape as the v3 order, with depth where holdings
 * were.
 */
const matchesAreOrdered = ({ matches }: ResultsShape): boolean =>
  matches.every((match, index) => {
    const previous = matches[index - 1];
    if (previous === undefined) return true;
    if (previous.exactSymbolMatches !== match.exactSymbolMatches) {
      return previous.exactSymbolMatches > match.exactSymbolMatches;
    }

    const before = depthInEth(previous);
    const after = depthInEth(match);
    if (before === null) return after === null;
    if (after === null) return true;

    return before >= after;
  });

export const V4PoolSearchResultsSchema = z
  .strictObject({
    terms: PoolSearchTermsSchema,
    fetchedAt: IsoTimestampSchema,
    source: V4PoolSearchSourceSchema,
    matches: z.array(V4PoolSearchMatchSchema).max(V4_POOL_SEARCH_RESULT_LIMIT, {
      error: "A search returned more pools than this application asked for.",
    }),
  })
  .refine(matchesAreDistinct, {
    error: "The same pool appears twice in one set of search results.",
    path: ["matches"],
  })
  .refine(scoresAreCorrect, {
    error: "A match's exact-symbol count does not follow from the terms and the pool's symbols.",
    path: ["matches"],
  })
  .refine(matchesAreOrdered, {
    error: "Search results must be ordered by exact symbol matches, then by depth at the current price.",
    path: ["matches"],
  });

export type V4PoolSearchResults = z.infer<typeof V4PoolSearchResultsSchema>;
