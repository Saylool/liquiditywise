import {
  type DataResult,
  PoolSearchTermsSchema,
  V4_POOL_SEARCH_RESULT_LIMIT,
  type V4PoolSearchResults,
} from "../../schemas";
import { fetchEthereumV4PoolStates } from "./ethereumV4PoolState";
import { V4_POOL_CARD_FRAGMENT } from "./v4PoolCardRawResponse";
import { normalizeV4PoolSearch, readV4SearchPools } from "./v4PoolSearchAdapter";
import type { PoolSearchDiagnostic } from "./v3PoolSearchAdapter";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * The v3 search documents, against the v4 subgraph — which answers them with
 * the same filters and the same aliased selections, verified against the
 * deployed schema rather than assumed.
 *
 * One addition: `poolManagers`. The chain read that follows needs the address
 * of the contract every v4 pool lives in, and it is asked of the source here
 * rather than written into this application. The subgraph indexes exactly one.
 */
export const V4_POOL_SEARCH_PAIR_QUERY = `query V4PoolSearchPair($first: String!, $second: String!, $limit: Int!) {
  forward: pools(
    where: { token0_: { symbol_contains_nocase: $first }, token1_: { symbol_contains_nocase: $second } }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...V4PoolCard
  }
  reverse: pools(
    where: { token0_: { symbol_contains_nocase: $second }, token1_: { symbol_contains_nocase: $first } }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...V4PoolCard
  }
  poolManagers(first: 1) {
    id
  }
  _meta {
    hasIndexingErrors
  }
}

${V4_POOL_CARD_FRAGMENT}`;

export const V4_POOL_SEARCH_SINGLE_QUERY = `query V4PoolSearchSingle($term: String!, $limit: Int!) {
  forward: pools(
    where: { token0_: { symbol_contains_nocase: $term } }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...V4PoolCard
  }
  reverse: pools(
    where: { token1_: { symbol_contains_nocase: $term } }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...V4PoolCard
  }
  poolManagers(first: 1) {
    id
  }
  _meta {
    hasIndexingErrors
  }
}

${V4_POOL_CARD_FRAGMENT}`;

/** Twice what is published, for the reason the v3 window is. */
export const V4_POOL_SEARCH_FETCH_LIMIT = V4_POOL_SEARCH_RESULT_LIMIT * 2;

const INVALID_TERMS = "invalid-search-terms";
const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV4PoolSearchRequest = {
  readonly terms: readonly string[];
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  /** Raw environment value; without it the results arrive with no chain state. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly now: () => Date;
  readonly timeoutMs?: number;
  readonly onDiagnostic?: PoolSearchDiagnostic | undefined;
};

/**
 * Finds Ethereum mainnet Uniswap v4 pools whose currencies match one or two
 * terms, and asks the PoolManager what each one's liquidity is.
 *
 * Validation order matches the other readers: caller input first, then server
 * configuration, and neither reaches the network. A deployment with no v4
 * subgraph configured gets the same answer a v3 search gets without its own.
 */
export const fetchEthereumV4PoolSearch = async (
  request: EthereumV4PoolSearchRequest,
): Promise<DataResult<V4PoolSearchResults>> => {
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
    query: pair ? V4_POOL_SEARCH_PAIR_QUERY : V4_POOL_SEARCH_SINGLE_QUERY,
    variables: pair
      ? { first, second, limit: V4_POOL_SEARCH_FETCH_LIMIT }
      : { term: first, limit: V4_POOL_SEARCH_FETCH_LIMIT },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  /*
   * Which pools exist comes from the indexer; how deep each one is comes from
   * the PoolManager's own storage. The second read decides the order.
   */
  const { pools, poolManager } = readV4SearchPools(transport.payload);
  const states = await fetchEthereumV4PoolStates({
    poolIds: pools.map((pool) => pool.id),
    poolManager,
    rpcUrl: request.rpcUrl,
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs,
  });

  return normalizeV4PoolSearch({
    payload: transport.payload,
    states,
    terms: terms.data,
    fetchedAt: request.now().toISOString(),
    onDiagnostic: request.onDiagnostic,
  });
};
