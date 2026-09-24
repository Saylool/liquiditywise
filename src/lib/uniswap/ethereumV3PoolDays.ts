import type { DataResult } from "../../schemas";
import { poolDaysWindowStart, V4_POOL_DAYS_LIMIT, type V4PoolDays } from "./ethereumV4PoolDays";
import { POOL_CARD_FRAGMENT } from "./v3PoolCardRawResponse";
import {
  type FetchLike,
  postV3SubgraphQuery,
  SEARCH_SUBGRAPH_TIMEOUT_MS,
} from "./v3SubgraphTransport";

/*
 * The week's busiest v3 pool-days, with what each day traded and charged.
 *
 * The v3 half of the most-traded page. The v3 list the holdings lookup reads
 * is ordered by all-time volume, which says which pools were busy once; this
 * says which were busy this week, and by how much — the day table filtered by
 * date, which is also the query the v4 subgraph answers when every `pools`
 * query ordered by volume is refused.
 *
 * Each day carries its pool's whole card, as the v4 read does: a thousand days
 * name a few hundred pools, and one round trip is cheaper than two.
 */
export const V3_POOL_DAYS_QUERY = `query V3PoolDays($from: Int!, $limit: Int!) {
  poolDayDatas(
    where: { date_gte: $from }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    date
    volumeUSD
    feesUSD
    pool {
      ...PoolCard
    }
  }
  _meta {
    hasIndexingErrors
  }
}

${POOL_CARD_FRAGMENT}`;

const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV3PoolDaysRequest = {
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly now: () => Date;
  readonly timeoutMs?: number;
};

/** Reads the week's busiest v3 pool-days, the same window and size as the v4 read. */
export const fetchEthereumV3PoolDays = async (
  request: EthereumV3PoolDaysRequest,
): Promise<DataResult<V4PoolDays>> => {
  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const now = request.now();
  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: V3_POOL_DAYS_QUERY,
    variables: { from: poolDaysWindowStart(now), limit: V4_POOL_DAYS_LIMIT },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? SEARCH_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return { status: "success", data: { payload: transport.payload, fetchedAt: now.toISOString() } };
};
