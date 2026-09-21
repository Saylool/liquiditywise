import {
  type DataResult,
  POOL_SEARCH_RESULT_LIMIT,
  type PoolSearchResults,
  PoolSearchTermsSchema,
} from "../../schemas";
import { POOL_CARD_FRAGMENT } from "./v3PoolCardRawResponse";
import { fetchEthereumV3PoolReserves } from "./ethereumV3PoolReserves";
import {
  normalizeV3PoolSearch,
  type PoolSearchDiagnostic,
  readSearchPoolsForReserves,
} from "./v3PoolSearchAdapter";
import {
  SEARCH_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

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
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...PoolCard
  }
  reverse: pools(
    where: { token0_: { symbol_contains_nocase: $second }, token1_: { symbol_contains_nocase: $first } }
    orderBy: volumeUSD
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
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...PoolCard
  }
  reverse: pools(
    where: { token1_: { symbol_contains_nocase: $term } }
    orderBy: volumeUSD
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
 * More than are published, because this application does not publish the order
 * it receives. A pool named exactly what someone searched for can sit below
 * several whose tokens merely contain the word, so the window has to be wider
 * than the list or the relevant pool never arrives to be promoted.
 *
 * The window is taken by traded volume rather than by reported liquidity, and
 * that is a correction. Reported liquidity is the figure this application stopped
 * publishing: it overstates what pools hold by up to three orders of magnitude,
 * and selecting the window with it meant a pool that genuinely held a lot could
 * be left outside on the strength of a number that was wrong about a different
 * pool. Volume is money that moved, which is harder to inflate.
 *
 * It is still a window. A quiet pool with a matching name can fall outside it,
 * which is the honest limit of ranking within what a source chose to return.
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
  /** Raw environment value; without it the results arrive with no reserves. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  /** Injected, because a result carries when it was read. */
  readonly now: () => Date;
  /**
   * The budget for the source query, which is the slow half of a search. The
   * chain read below keeps its own, shorter one: a list that took the source
   * eighteen seconds should not then be allowed twenty more at the endpoint.
   */
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
    timeoutMs: request.timeoutMs ?? SEARCH_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  /*
   * Which pools exist comes from the indexer; what they hold comes from the
   * chain. The second read decides the order, and the indexer's own figure could
   * not: it published a WETH/LOOKS pool at nine million dollars while the
   * contracts held nine thousand, above pools that genuinely held more.
   */
  const reserves = await fetchEthereumV3PoolReserves({
    pools: readSearchPoolsForReserves(transport.payload, request.now()),
    rpcUrl: request.rpcUrl,
    fetchImpl: request.fetchImpl,
  });

  return normalizeV3PoolSearch({
    payload: transport.payload,
    reserves,
    terms: terms.data,
    fetchedAt: request.now().toISOString(),
    onDiagnostic: request.onDiagnostic,
  });
};
