import {
  countExactSymbolMatches,
  type DataFailureNotice,
  type DataResult,
  depthInEth,
  EvmAddressSchema,
  type PoolSearchTerms,
  V4_POOL_SEARCH_RESULT_LIMIT,
  type V4Pool,
  type V4PoolSearchMatch,
  type V4PoolSearchResults,
  V4PoolSearchResultsSchema,
} from "../../schemas";
import type { V4PoolState } from "./ethereumV4PoolState";
import { normalizeV4PoolCard } from "./v4PoolCardAdapter";
import { type RawV4PoolCard, V4PoolSearchResponseSchema } from "./v4PoolCardRawResponse";
import type { PoolSearchDiagnostic } from "./v3PoolSearchAdapter";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<V4PoolSearchResults> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/**
 * Turns one raw pool into a match, or `null` if it cannot be trusted.
 *
 * Verifying the pool is the card's job; a search adds the one field the card
 * knows nothing about, which is how well this pool answers what was typed, and
 * attaches what the chain said about it.
 */
const normalizeMatch = (
  raw: RawV4PoolCard,
  terms: PoolSearchTerms,
  states: ReadonlyMap<string, V4PoolState>,
): V4PoolSearchMatch | null => {
  const card = normalizeV4PoolCard(raw);
  if (card === null) return null;

  return {
    pool: card.pool,
    ethPrice: card.ethPrice,
    state: states.get(card.pool.id) ?? null,
    exactSymbolMatches: countExactSymbolMatches(terms, [
      card.pool.token0.symbol,
      card.pool.token1.symbol,
    ]),
  };
};

/**
 * The verified pools in a search payload, and the PoolManager to ask about them.
 *
 * The same card normaliser runs here and again below, so a pool the chain was
 * asked about is exactly a pool that can appear in the results. The manager's
 * address is validated here rather than trusted, because it decides which
 * contract's storage the next request reads.
 */
export const readV4SearchPools = (
  payload: unknown,
): { readonly pools: readonly V4Pool[]; readonly poolManager: string | null } => {
  const parsed = V4PoolSearchResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data == null) return { pools: [], poolManager: null };

  const pools = new Map<string, V4Pool>();
  for (const raw of [...parsed.data.data.forward, ...parsed.data.data.reverse]) {
    const card = normalizeV4PoolCard(raw);
    if (card !== null) pools.set(card.pool.id, card.pool);
  }

  const manager = EvmAddressSchema.safeParse(parsed.data.data.poolManagers[0]?.id);

  return { pools: [...pools.values()], poolManager: manager.success ? manager.data : null };
};

/**
 * Exact symbol matches first, then depth at the current price, then the pool's
 * own id so that ties come back in one order every time. A pool the chain could
 * not be read for has no place in a size order and goes last.
 */
const byRelevanceThenDepth = (left: V4PoolSearchMatch, right: V4PoolSearchMatch): number => {
  if (left.exactSymbolMatches !== right.exactSymbolMatches) {
    return right.exactSymbolMatches - left.exactSymbolMatches;
  }

  const leftDepth = depthInEth(left);
  const rightDepth = depthInEth(right);
  if (leftDepth !== rightDepth) {
    if (leftDepth === null) return 1;
    if (rightDepth === null) return -1;
    return rightDepth - leftDepth;
  }

  return left.pool.id.localeCompare(right.pool.id);
};

export type NormalizeV4PoolSearchInput = {
  /** The decoded JSON body, still untrusted. */
  readonly payload: unknown;
  /**
   * Each pool's liquidity and price, read from the PoolManager, keyed by pool id.
   *
   * Passed in rather than patched on afterwards so both sources go through the
   * domain schema together — and this one decides the order, which is the claim
   * the schema exists to check.
   */
  readonly states: ReadonlyMap<string, V4PoolState>;
  /** The terms this search was run with, already validated. */
  readonly terms: PoolSearchTerms;
  /** When the request was made, from the reader's injected clock. */
  readonly fetchedAt: string;
  readonly onDiagnostic?: PoolSearchDiagnostic | undefined;
};

/**
 * Turns one raw v4 search payload into the domain type, or into an explicit
 * failure. Pure: no clock, no network, no environment.
 *
 * The merge and the order are this application's own claims, made here and
 * checked by the schema rather than taken from the provider. There is no
 * `partial` outcome: a search produces a list — possibly empty, which is a real
 * answer — or nothing.
 */
export const normalizeV4PoolSearch = ({
  payload,
  states,
  terms,
  fetchedAt,
  onDiagnostic,
}: NormalizeV4PoolSearchInput): DataResult<V4PoolSearchResults> => {
  const parsed = V4PoolSearchResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const byPoolId = new Map<string, V4PoolSearchMatch>();
  let dropped = 0;

  for (const raw of [...data.forward, ...data.reverse]) {
    const match = normalizeMatch(raw, terms, states);
    if (match === null) {
      dropped += 1;
      continue;
    }
    if (!byPoolId.has(match.pool.id)) byPoolId.set(match.pool.id, match);
  }

  if (dropped > 0) {
    onDiagnostic?.(`${dropped} of ${data.forward.length + data.reverse.length} v4 pools unverifiable`);
  }

  const candidate = {
    terms,
    fetchedAt,
    source: "uniswap-v4-subgraph",
    matches: [...byPoolId.values()]
      .sort(byRelevanceThenDepth)
      .slice(0, V4_POOL_SEARCH_RESULT_LIMIT),
  };

  const results = V4PoolSearchResultsSchema.safeParse(candidate);
  if (!results.success) return unavailable(MALFORMED);

  return { status: "success", data: results.data };
};
