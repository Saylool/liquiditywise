import type { DataResult, V4PoolCandidateList } from "../../schemas";
import { TRADED_POOL_LIMIT, TRADED_POOL_MIN_TX_COUNT } from "./ethereumV3TradedPools";
import { V4_POOL_CARD_FRAGMENT } from "./v4PoolCardRawResponse";
import { normalizeV4TradedPools } from "./v4TradedPoolsAdapter";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * The v4 pools a holdings lookup draws its candidate currencies from.
 *
 * The v3 query against the v4 subgraph, with the v4 card: ordered by traded
 * volume and filtered on transaction count, for the reasons the v3 reader gives.
 * The same two thresholds, imported rather than restated, so the two nets are
 * the same width by construction.
 *
 * What this list adds that the v3 one cannot is the chain's own ether. A v4
 * pool may hold it as a currency, under the zero address, and an address that
 * holds ether — every address that has ever paid for gas — has a side of every
 * such pool already.
 */
export const V4_TRADED_POOLS_QUERY = `query V4TradedPools($minTxCount: BigInt!, $limit: Int!) {
  pools(
    where: { txCount_gt: $minTxCount }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...V4PoolCard
  }
  _meta {
    hasIndexingErrors
  }
}

${V4_POOL_CARD_FRAGMENT}`;

const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV4TradedPoolsRequest = {
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly now: () => Date;
  readonly timeoutMs?: number;
};

/** Reads the most-traded Ethereum mainnet Uniswap v4 pools. No caller input to validate. */
export const fetchEthereumV4TradedPools = async (
  request: EthereumV4TradedPoolsRequest,
): Promise<DataResult<V4PoolCandidateList>> => {
  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: V4_TRADED_POOLS_QUERY,
    variables: { minTxCount: TRADED_POOL_MIN_TX_COUNT, limit: TRADED_POOL_LIMIT },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return normalizeV4TradedPools({
    payload: transport.payload,
    fetchedAt: request.now().toISOString(),
  });
};
