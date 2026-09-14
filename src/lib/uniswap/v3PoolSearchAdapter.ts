import {
  countExactSymbolMatches,
  type DataResult,
  POOL_SEARCH_RESULT_LIMIT,
  type PoolSearchMatch,
  type PoolSearchResults,
  PoolSearchResultsSchema,
  type PoolSearchTerms,
  V3PoolMetadataSchema,
} from "../../schemas";
import { type RawSearchPool, V3PoolSearchResponseSchema } from "./v3PoolSearchRawResponse";
import { convertNonNegativeDecimal, convertSafeInteger } from "./v3SubgraphRawResponse";
import { normalizeV3Token } from "./v3TokenAdapter";

/** This adapter reads Ethereum mainnet only; multi-chain support is not modelled yet. */
export const ETHEREUM_MAINNET_CHAIN_ID = 1;

const MALFORMED = "The market data source returned a response this application cannot verify.";
const INDEXING_ERRORS =
  "The market data source reported indexing errors, so its figures cannot be treated as verified.";

const unavailable = (message: string): DataResult<PoolSearchResults> => ({
  status: "unavailable",
  reason: "invalid-response",
  message,
});

/** Told which rule dropped a pool, and nothing about the pool. Optional. */
export type PoolSearchDiagnostic = (detail: string) => void;

/**
 * Turns one raw pool into a match, or `null` if it cannot be trusted.
 *
 * A list is the one place in this application where a single bad entry does not
 * have to sink the answer. Everywhere else the visitor asked about one pool and
 * the only honest replies were that pool or nothing; here a reader asked "which
 * pools are these", and eleven verified answers plus one dropped is a true — if
 * shorter — reply to that question.
 *
 * It is also what the token-label rules are for. A pool whose symbol carries a
 * newline leaves the list instead of taking the page down with it, and the
 * reader never learns that a token tried to write a line of its own.
 */
const normalizeMatch = (raw: RawSearchPool, terms: PoolSearchTerms): PoolSearchMatch | null => {
  const feePpm = convertSafeInteger(raw.feeTier);
  if (!feePpm.ok) return null;

  /*
   * Zero is allowed: a pool that has been fully withdrawn from reports exactly
   * that, and it is a fact about the pool rather than a broken reading. It sorts
   * to the bottom on its own.
   */
  const tvlUsd = convertNonNegativeDecimal(raw.totalValueLockedUSD, { allowZero: true });
  if (!tvlUsd.ok) return null;

  const token0 = normalizeV3Token(raw.token0, ETHEREUM_MAINNET_CHAIN_ID);
  const token1 = normalizeV3Token(raw.token1, ETHEREUM_MAINNET_CHAIN_ID);
  if (token0 === null || token1 === null) return null;

  /*
   * The same authority the single-pool read defers to: the fee bound, the uint8
   * decimals, the non-zero token addresses, the token labels, and that token0
   * sorts before token1. A search result is a link to an analysis, so a pair
   * that arrived the wrong way round has to be refused here rather than
   * discovered later.
   */
  const pool = V3PoolMetadataSchema.safeParse({
    protocolVersion: "v3",
    chainId: ETHEREUM_MAINNET_CHAIN_ID,
    id: raw.id,
    token0,
    token1,
    feePpm: feePpm.value,
  });
  if (!pool.success) return null;

  return {
    pool: pool.data,
    tvlUsd: tvlUsd.value,
    exactSymbolMatches: countExactSymbolMatches(terms, [token0.symbol, token1.symbol]),
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
