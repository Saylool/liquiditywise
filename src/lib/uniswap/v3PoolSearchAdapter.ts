import {
  countExactSymbolMatches,
  type DataFailureNotice,
  type DataResult,
  POOL_SEARCH_RESULT_LIMIT,
  type PoolSearchMatch,
  type PoolSearchResults,
  PoolSearchResultsSchema,
  type PoolSearchTerms,
} from "../../schemas";
import { normalizePoolCard } from "./v3PoolCardAdapter";
import type { RawPoolCard } from "./v3PoolCardRawResponse";
import { V3PoolSearchResponseSchema } from "./v3PoolSearchRawResponse";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<PoolSearchResults> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/** Told which rule dropped a pool, and nothing about the pool. Optional. */
export type PoolSearchDiagnostic = (detail: string) => void;

/**
 * Turns one raw pool into a match, or `null` if it cannot be trusted.
 *
 * Verifying the pool is the shared card's job, and everything a search adds on
 * top is the one field the card knows nothing about: how well this pool answers
 * what was actually typed.
 *
 * Dropping an entry rather than failing the read is what the token-label rules
 * are for. A pool whose symbol carries a newline leaves the list instead of
 * taking the page down with it, and the reader never learns that a token tried
 * to write a line of its own.
 */
const normalizeMatch = (raw: RawPoolCard, terms: PoolSearchTerms): PoolSearchMatch | null => {
  const card = normalizePoolCard(raw);
  if (card === null) return null;

  return {
    ...card,
    exactSymbolMatches: countExactSymbolMatches(terms, [
      card.pool.token0.symbol,
      card.pool.token1.symbol,
    ]),
  };
};

/**
 * Puts the merged matches in the order the results are published in.
 *
 * Exact symbol matches first, then the liquidity the source reports, then the
 * pool's own address. The last of those decides nothing a reader cares about and
 * is there so that two pools the first two cannot separate still come back in
 * the same order every time — a list that reshuffles between two identical
 * searches is a list nobody can point at.
 */
const byRelevanceThenLiquidity = (left: PoolSearchMatch, right: PoolSearchMatch): number =>
  right.exactSymbolMatches - left.exactSymbolMatches ||
  right.tvlUsd - left.tvlUsd ||
  left.pool.id.localeCompare(right.pool.id);

export type NormalizeV3PoolSearchInput = {
  /** The decoded JSON body, still untrusted. */
  readonly payload: unknown;
  /** The terms this search was run with, already validated. */
  readonly terms: PoolSearchTerms;
  /** When the request was made, from the reader's injected clock. */
  readonly fetchedAt: string;
  readonly onDiagnostic?: PoolSearchDiagnostic | undefined;
};

/**
 * Turns one raw search payload into the domain type, or into an explicit
 * failure. Pure: no clock, no network, no environment.
 *
 * The two aliased selections are merged here rather than upstream, because
 * merging is where the work is: a pool matching both terms appears in both
 * lists, each list is sorted only within itself, and the order the results are
 * published in is this application's own claim rather than the provider's.
 *
 * There is no `partial` outcome. A search either produces a list — possibly an
 * empty one, which is a real answer — or it produces nothing.
 */
export const normalizeV3PoolSearch = ({
  payload,
  terms,
  fetchedAt,
  onDiagnostic,
}: NormalizeV3PoolSearchInput): DataResult<PoolSearchResults> => {
  const parsed = V3PoolSearchResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;

  // Fail closed: a GraphQL response may carry data beside errors, and that data
  // is not verified.
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const byPoolId = new Map<string, PoolSearchMatch>();
  let dropped = 0;

  for (const raw of [...data.forward, ...data.reverse]) {
    const match = normalizeMatch(raw, terms);
    if (match === null) {
      dropped += 1;
      continue;
    }
    // A pool matching both terms arrives in both selections. The two copies are
    // the same pool read the same way, so the first one stands.
    if (!byPoolId.has(match.pool.id)) byPoolId.set(match.pool.id, match);
  }

  if (dropped > 0) {
    onDiagnostic?.(`${dropped} of ${data.forward.length + data.reverse.length} pools unverifiable`);
  }

  const candidate = {
    terms,
    fetchedAt,
    source: "uniswap-v3-subgraph",
    matches: [...byPoolId.values()]
      .sort(byRelevanceThenLiquidity)
      .slice(0, POOL_SEARCH_RESULT_LIMIT),
  };

  /*
   * The domain schema is the final authority, and for a search it checks this
   * application's work rather than the provider's: that no pool is listed twice,
   * that every relevance score follows from the terms and the pool's own
   * symbols, and that the order is the one claimed. A merge that went wrong
   * produces a plausible-looking list, which is exactly the kind of mistake that
   * survives review.
   */
  const results = PoolSearchResultsSchema.safeParse(candidate);
  if (!results.success) return unavailable(MALFORMED);

  return { status: "success", data: results.data };
};
