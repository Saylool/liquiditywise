import { z } from "zod";

import { DataSourceSchema } from "./dataSource";
import { IsoTimestampSchema, UnsignedIntegerStringSchema } from "./primitives";
import { PoolSearchTermsSchema } from "./searchTerms";
import { V3PoolMetadataSchema } from "./uniswap";

/*
 * What a pool search is allowed to return.
 *
 * Search is the first thing this application does that *chooses* what a reader
 * looks at. Every other read answers a question with one pool in it: the visitor
 * supplied an address, and the only honest answer was that pool or nothing. A
 * list is different — whatever sits at the top is what most people will open —
 * so the order is a claim, and it is made here where it can be checked.
 *
 * The claim is deliberately small, and it is not about quality. There is no
 * score, no badge, no "verified" mark and no list of tokens this application has
 * decided are the real ones. A symbol is whatever its contract says and anyone
 * can deploy a contract that says "USDC"; the answer to that is to show the
 * contract address beside every symbol, not to decide on a reader's behalf which
 * one is genuine.
 */

/**
 * How many pools one search returns.
 *
 * Enough that a pair's fee tiers all fit, few enough that the list is read
 * rather than scrolled. Every match is a pool someone may then analyse, so a
 * longer list is also a larger invitation to spend upstream quota.
 */
export const POOL_SEARCH_RESULT_LIMIT = 12;

/** The only source that can answer a v3 pool search. */
export const PoolSearchSourceSchema = DataSourceSchema.extract(["uniswap-v3-subgraph"]);

export const PoolSearchMatchSchema = z.strictObject({
  /**
   * The same contract every other read produces, invariants included — the token
   * ordering in particular, which is what makes the pair safe to render in the
   * order it arrives.
   *
   * A match deliberately carries no price and no tick. Those are a moment's
   * reading and belong to the analysis; a list of candidates is identity only.
   */
  pool: V3PoolMetadataSchema,
  /**
   * What the pool contract actually holds, in each token's own base units.
   *
   * Read from the token contracts rather than taken from the indexer, because
   * the indexer's figure is wrong and wrong in a way that reorders this list. A
   * WETH/LOOKS pool was published here at nine million dollars of reported
   * liquidity while its contracts held three and a half WETH — nine thousand
   * dollars, a thousandth of the claim — and it sat above pools that genuinely
   * held more.
   *
   * `null` when the chain could not be read, which is not an empty pool.
   */
  reserves: z
    .strictObject({
      token0: UnsignedIntegerStringSchema,
      token1: UnsignedIntegerStringSchema,
    })
    .nullable(),
  /**
   * What one of each token is worth in ether, as the source derives it.
   *
   * The half of the ordering that makes two different pairs comparable, and the
   * half the source can still be trusted for: a price comes out of a pool's
   * `sqrtPrice`, which is chain state, while a balance is accumulated from
   * events and drifts. Checked against live data — a stablecoin at 0.000403 ETH,
   * a liquid-staking token at 1.103, a near-worthless one at 3e-8.
   */
  ethPrice: z
    .strictObject({
      token0: z.number().min(0),
      token1: z.number().min(0),
    })
    .nullable(),
  /**
   * How many of this pool's two sides carry a symbol that is exactly one of the
   * search terms, ignoring case. The other half of the order.
   *
   * The source matches on a substring, which is what makes a search for "weth"
   * work when the symbol is "WETH" — and also what makes it return WPOWETH,
   * MeWETH, and a pool whose token is called "ease.org" beside one called
   * "ez-SLP-WBTC-WETH". That last one was the top result for "weth" ordered by
   * reported liquidity alone, on the strength of a dollar figure the source
   * derives and plainly got wrong.
   *
   * Ordering exact symbols first is a statement about relevance to what was
   * typed, not about which token is trustworthy. It is computed from the terms
   * and the pool's own symbols, so {@link PoolSearchResultsSchema} re-derives it
   * rather than believing it.
   */
  exactSymbolMatches: z.int().min(0).max(2),
});

export type PoolSearchMatch = z.infer<typeof PoolSearchMatchSchema>;

/**
 * What a pool holds, valued in ether, or `null` when it cannot be known.
 *
 * Exported because two places need exactly this number and must not disagree:
 * the adapter that orders the list, and the schema that checks the order it
 * claims. Ether rather than dollars because ordering only needs a common unit,
 * and introducing a dollar figure would mean introducing one more derived number
 * to display and defend.
 *
 * Base units are converted here, where the token's decimals are in hand. A
 * balance can exceed what a double holds exactly; for a ranking key that is
 * harmless, and it is never shown.
 */
export const heldInEth = (match: {
  readonly pool: { readonly token0: { readonly decimals: number }; readonly token1: { readonly decimals: number } };
  readonly reserves: { readonly token0: string; readonly token1: string } | null;
  readonly ethPrice: { readonly token0: number; readonly token1: number } | null;
}): number | null => {
  if (match.reserves === null || match.ethPrice === null) return null;

  const value =
    (Number(match.reserves.token0) / 10 ** match.pool.token0.decimals) * match.ethPrice.token0 +
    (Number(match.reserves.token1) / 10 ** match.pool.token1.decimals) * match.ethPrice.token1;

  return Number.isFinite(value) ? value : null;
};

/** `toLowerCase` rather than the locale-aware form: a ticker is not Turkish text. */
const foldCase = (value: string): string => value.toLowerCase();

/**
 * How many of a pool's sides carry a symbol that is exactly one of the terms.
 *
 * Counts *sides*, not terms, so searching the same word twice cannot score a
 * pool that only matches it once.
 */
export const countExactSymbolMatches = (
  terms: readonly string[],
  symbols: readonly [string, string],
): number => {
  const folded = terms.map(foldCase);

  return symbols.filter((symbol) => folded.includes(foldCase(symbol))).length;
};

type ResultsShape = {
  readonly terms: readonly string[];
  readonly matches: readonly PoolSearchMatch[];
};

/**
 * Two aliased selections answer one search — one for each way round the pair can
 * be stored — so a pool matching both sides arrives twice. Merging them is the
 * adapter's job, and forgetting to is invisible in a list of similar rows.
 */
const matchesAreDistinct = ({ matches }: ResultsShape): boolean =>
  new Set(matches.map((match) => match.pool.id)).size === matches.length;

/**
 * The ranking key is re-derived from the terms and the pool's own symbols rather
 * than taken on trust. It is the one number here that this application computed,
 * and a wrong one silently reorders the list.
 */
const scoresAreCorrect = ({ terms, matches }: ResultsShape): boolean =>
  matches.every(
    (match) =>
      match.exactSymbolMatches ===
      countExactSymbolMatches(terms, [match.pool.token0.symbol, match.pool.token1.symbol]),
  );

/**
 * The order is the claim, so it is checked rather than assumed. An adapter that
 * concatenated two already-sorted lists without merging them produces a sequence
 * that looks sorted at a glance and puts a dead pool above a real one.
 *
 * A pool whose reserves could not be read has no place in the size order, so it
 * goes last rather than being sorted as though it were empty.
 */
const matchesAreOrdered = ({ matches }: ResultsShape): boolean =>
  matches.every((match, index) => {
    const previous = matches[index - 1];
    if (previous === undefined) return true;
    if (previous.exactSymbolMatches !== match.exactSymbolMatches) {
      return previous.exactSymbolMatches > match.exactSymbolMatches;
    }

    const before = heldInEth(previous);
    const after = heldInEth(match);
    if (before === null) return after === null;
    if (after === null) return true;

    return before >= after;
  });

export const PoolSearchResultsSchema = z
  .strictObject({
    /**
     * What was searched for.
     *
     * Carried with the results rather than left to the caller, because the
     * ranking is only meaningful against them — and because a page that names
     * the terms it used shows a reader when a third term was dropped.
     */
    terms: PoolSearchTermsSchema,
    /** When this application asked. A search result is a reading, not a fact. */
    fetchedAt: IsoTimestampSchema,
    source: PoolSearchSourceSchema,
    matches: z.array(PoolSearchMatchSchema).max(POOL_SEARCH_RESULT_LIMIT, {
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
    error: "Search results must be ordered by exact symbol matches, then by reported liquidity.",
    path: ["matches"],
  });

export type PoolSearchResults = z.infer<typeof PoolSearchResultsSchema>;
