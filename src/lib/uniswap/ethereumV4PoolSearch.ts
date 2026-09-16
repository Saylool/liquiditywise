import {
  type DataResult,
  PoolSearchTermsSchema,
  type V4PoolSearchResults,
} from "../../schemas";
import {
  tradedWindowStart,
  V4_TRADED_POOL_DAYS_LIMIT,
  V4_TRADED_POOLS_QUERY,
} from "./ethereumV4TradedPools";
import { fetchEthereumV4PoolKeys } from "./ethereumV4PoolKeys";
import { fetchEthereumV4PoolStates } from "./ethereumV4PoolState";
import { hookedRefs, normalizeV4PoolSearch, readV4SearchPools } from "./v4PoolSearchAdapter";
import type { PoolSearchDiagnostic } from "./v3PoolSearchAdapter";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/*
 * The v4 search does not ask the source for the pools matching the terms. It
 * asks for the week's busiest pool-days — the same request the holdings net
 * is read with — and matches the terms against the pools those days name.
 *
 * Because the source cannot be asked. The v3 search documents, run against the
 * v4 subgraph, were answered by its gateway with fifteen seconds of silence
 * and then an error naming both of the subgraph's indexers as bad, on every
 * attempt of 2026-09-16 — and so was every reshaping of them: a prefix match
 * instead of a substring, an exact symbol, the token ids looked up first and
 * the pools asked for by id, the day table filtered through the pool. What the
 * gateway answered, in under a second, was the day table filtered by date.
 *
 * So the window is the week's activity rather than the terms, and the page
 * says so. The terms are never sent anywhere: they are matched here, against
 * symbols the source already returned.
 */

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
 * Finds the Ethereum mainnet Uniswap v4 pools among this week's busiest whose
 * currencies match one or two terms, and asks the PoolManager what each one's
 * liquidity is.
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

  const now = request.now();
  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: V4_TRADED_POOLS_QUERY,
    variables: { from: tradedWindowStart(now), limit: V4_TRADED_POOL_DAYS_LIMIT },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  /*
   * Which pools exist comes from the indexer; which of them answer the terms
   * is decided here; what each one is and how deep it is come from the chain
   * — the key from the log that created the pool, the state from the
   * PoolManager's storage. The two reads run together; the state decides the
   * order and the key decides the fee.
   */
  const { pools, poolManager } = readV4SearchPools(transport.payload, terms.data);
  const chain = {
    poolManager,
    rpcUrl: request.rpcUrl,
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs,
  };
  /*
   * The creation log is read for hooked pools only. A pool with no hook cannot
   * be dynamic, so the fee its state stores is its key's — and the state is
   * read for every pool anyway, for the depth. Logs are the costly read on the
   * endpoint's budget, and this keeps them to the pools whose fee kind they
   * alone can settle.
   */
  const [keys, states] = await Promise.all([
    fetchEthereumV4PoolKeys({ pools: hookedRefs(pools), ...chain }),
    fetchEthereumV4PoolStates({ poolIds: pools.map((pool) => pool.id), ...chain }),
  ]);

  return normalizeV4PoolSearch({
    payload: transport.payload,
    states,
    keys,
    terms: terms.data,
    fetchedAt: now.toISOString(),
    onDiagnostic: request.onDiagnostic,
  });
};
