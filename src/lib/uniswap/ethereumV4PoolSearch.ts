import {
  type DataResult,
  PoolSearchTermsSchema,
  type V4PoolSearchResults,
} from "../../schemas";
import type { ReadV4PoolDays } from "./ethereumV4PoolDays";
import { fetchEthereumV4PoolKeys } from "./ethereumV4PoolKeys";
import { fetchEthereumV4PoolStates } from "./ethereumV4PoolState";
import { hookedRefs, normalizeV4PoolSearch, readV4SearchPools } from "./v4PoolSearchAdapter";
import type { PoolSearchDiagnostic } from "./v3PoolSearchAdapter";
import { type FetchLike } from "./v3SubgraphTransport";

/*
 * The v4 search does not ask the source for the pools matching the terms. It
 * reads the week's busiest pool-days — the very same read the holdings net
 * uses, cached and shared — and matches the terms against the pools those days
 * name.
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

export type EthereumV4PoolSearchRequest = {
  readonly terms: readonly string[];
  /**
   * The week's pool-days, asked for only once the terms are known to be
   * usable — a search this application refuses must read nothing.
   */
  readonly readDays: ReadV4PoolDays;
  /** Raw environment value; without it the results arrive with no chain state. */
  readonly rpcUrl: string | undefined;
  /** For the chain reads below. The day table is read by {@link readDays}. */
  readonly fetchImpl: FetchLike;
  /** The chain reads' budget. The list's own is spent inside {@link readDays}. */
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

  const days = await request.readDays();
  if (days.status === "unavailable") {
    return { status: "unavailable", reason: days.reason, notice: days.notice };
  }

  /*
   * Which pools exist comes from the indexer; which of them answer the terms
   * is decided here; what each one is and how deep it is come from the chain
   * — the key from the log that created the pool, the state from the
   * PoolManager's storage. The two reads run together; the state decides the
   * order and the key decides the fee.
   */
  const { pools, poolManager } = readV4SearchPools(days.data.payload, terms.data);
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

  /*
   * Stamped with the moment the list was read rather than the moment this page
   * rendered, because that read is shared and may be minutes old. The chain
   * figures beside it are this moment's, as they are in the v3 search: a list
   * the source chose, ordered by what the chain says now.
   */
  return normalizeV4PoolSearch({
    payload: days.data.payload,
    states,
    keys,
    terms: terms.data,
    fetchedAt: days.data.fetchedAt,
    onDiagnostic: request.onDiagnostic,
  });
};
