import {
  type DataResult,
  POOL_SEARCH_RESULT_LIMIT,
  type PoolSearchResults,
  PoolSearchTermsSchema,
} from "../../schemas";
import { normalizeV3PoolSearch, type PoolSearchDiagnostic } from "./v3PoolSearchAdapter";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * The fields a candidate is shown by, as a fragment so the two search documents
 * cannot drift apart in what they select.
 */
const POOL_CARD_FRAGMENT = `fragment PoolCard on Pool {
  id
  feeTier
  totalValueLockedUSD
  token0 {
    id
    symbol
    name
    decimals
  }
  token1 {
    id
    symbol
    name
    decimals
  }
}`;

/**
 * A pool stores its pair in address order, which has nothing to do with the
 * order someone types it, so the pair query asks both ways round in one request.
 *
 * Two aliased selections rather than a disjunction: `or` is a newer graph-node
 * filter and a filter the gateway rejects fails the whole request, while aliases
 * are ordinary GraphQL that every version has understood. The terms travel as
 * variables and are never spliced into this text.
 */
export const V3_POOL_SEARCH_PAIR_QUERY = `query PoolSearchPair($first: String!, $second: String!, $limit: Int!) {
  forward: pools(
    where: { token0_: { symbol_contains_nocase: $first }, token1_: { symbol_contains_nocase: $second } }
    orderBy: totalValueLockedUSD
    orderDirection: desc
    first: $limit
  ) {
    ...PoolCard
  }
  reverse: pools(
    where: { token0_: { symbol_contains_nocase: $second }, token1_: { symbol_contains_nocase: $first } }
    orderBy: totalValueLockedUSD
    orderDirection: desc
    first: $limit
  ) {
    ...PoolCard
  }
  _meta {
    hasIndexingErrors
  }
}

${POOL_CARD_FRAGMENT}`;

/** One term, so each selection pins the side it matched instead of the pair. */
export const V3_POOL_SEARCH_SINGLE_QUERY = `query PoolSearchSingle($term: String!, $limit: Int!) {
  forward: pools(
    where: { token0_: { symbol_contains_nocase: $term } }
    orderBy: totalValueLockedUSD
    orderDirection: desc
    first: $limit
  ) {
    ...PoolCard
  }
  reverse: pools(
    where: { token1_: { symbol_contains_nocase: $term } }
    orderBy: totalValueLockedUSD
    orderDirection: desc
    first: $limit
  ) {
    ...PoolCard
  }
  _meta {
    hasIndexingErrors
  }
}

${POOL_CARD_FRAGMENT}`;

/**
 * How many pools to ask each selection for.
 *
 * More than are published, because the source orders by its own dollar figure
 * and this application does not. A pool named exactly what someone searched for
 * can sit below several whose tokens merely contain the word, so the window has
 * to be wider than the list or the relevant pool never arrives to be promoted.
 *
 * It is still a window. A pool with little liquidity and a matching name can
 * fall outside it, which is the honest limit of ranking within what a source
 * chose to return.
 */
export const POOL_SEARCH_FETCH_LIMIT = POOL_SEARCH_RESULT_LIMIT * 2;

const INVALID_TERMS = "invalid-search-terms";
const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV3PoolSearchRequest = {
  /** What to search for. Validated here; the caller's parse is not trusted. */
  readonly terms: readonly string[];
  /** Raw environment values; validated here so the wrapper stays free of logic. */
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  /** Injected, because a result carries when it was read. */
  readonly now: () => Date;
  readonly timeoutMs?: number;
  readonly onDiagnostic?: PoolSearchDiagnostic | undefined;
};

/**
 * Finds Ethereum mainnet Uniswap v3 pools whose tokens match one or two terms.
 *
 * The source matches on a substring, which is what lets "weth" find "WETH" —
 * and also what makes it return WPOWETH and MeWETH. Deciding between those is
 * the adapter's job and it does it by relevance to what was typed, not by any
 * view about which token is genuine.
 *
 * Validation order matches the other readers: caller input first, then server
 * configuration, and neither reaches the network.
 */
export const fetchEthereumV3PoolSearch = async (
  request: EthereumV3PoolSearchRequest,
): Promise<DataResult<PoolSearchResults>> => {
  const terms = PoolSearchTermsSchema.safeParse(request.terms);
  if (!terms.success) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_TERMS };
  }

  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const [first, second] = terms.data;
  const pair = second !== undefined;

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: pair ? V3_POOL_SEARCH_PAIR_QUERY : V3_POOL_SEARCH_SINGLE_QUERY,
    variables: pair
      ? { first, second, limit: POOL_SEARCH_FETCH_LIMIT }
      : { term: first, limit: POOL_SEARCH_FETCH_LIMIT },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return normalizeV3PoolSearch({
    payload: transport.payload,
    terms: terms.data,
    fetchedAt: request.now().toISOString(),
    onDiagnostic: request.onDiagnostic,
  });
};
