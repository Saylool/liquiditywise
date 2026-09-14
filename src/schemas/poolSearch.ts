import { z } from "zod";

import { DataSourceSchema } from "./dataSource";
import { IsoTimestampSchema, UsdAmountSchema } from "./primitives";
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
   * What the source reports is locked in the pool, in US dollars.
   *
   * The provider's figure, not one this application computed or cross-checked,
   * and the interface says so where it is shown. It is here because it is half
   * of what the list is ordered by, and a ranking whose criterion is hidden is
   * worse than no ranking at all.
   */
  tvlUsd: UsdAmountSchema,
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
 */
const matchesAreOrdered = ({ matches }: ResultsShape): boolean =>
  matches.every((match, index) => {
    const previous = matches[index - 1];
    if (previous === undefined) return true;
    if (previous.exactSymbolMatches !== match.exactSymbolMatches) {
      return previous.exactSymbolMatches > match.exactSymbolMatches;
    }
    return previous.tvlUsd >= match.tvlUsd;
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
