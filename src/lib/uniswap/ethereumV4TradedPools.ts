import type { DataResult, V4PoolCandidateList } from "../../schemas";
import { V4_POOL_CARD_FRAGMENT } from "./v4PoolCardRawResponse";
import { normalizeV4TradedPools } from "./v4TradedPoolsAdapter";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * The v4 pools a holdings lookup draws its candidate currencies from — and the
 * window a v4 search is run over, because it is the one list of v4 pools the
 * source will answer for.
 *
 * Not the v3 query. Asked for `pools` ordered by volume — with the v3 filter,
 * without it, by transaction count instead, for two hundred and fifty or for
 * fifty — the v4 subgraph's gateway answered every variant the same way on
 * 2026-09-16: fifteen seconds, then an error naming both indexers serving the
 * subgraph as bad. Every search that filtered `pools` by a token's symbol met
 * the same answer. What the same gateway answered in under a second, cold,
 * was the day table: `poolDayDatas` filtered by date and ordered by the day's
 * volume.
 *
 * So the net is the busiest pool-days of the last week, and the pools those
 * days belong to. A pool that traded heavily on any day of the window is in;
 * one that traded on none is not — which is what a net of "pools that have
 * actually been traded" was for, and a narrower claim than the v3 list's
 * all-time volume. Folded into pools the net is the v3 one's width: the
 * adapter keeps {@link TRADED_POOL_LIMIT} of them at most.
 *
 * What this list adds that the v3 one cannot is the chain's own ether. A v4
 * pool may hold it as a currency, under the zero address, and an address that
 * holds ether — every address that has ever paid for gas — has a side of every
 * such pool already.
 *
 * `poolManagers` is asked for so the holdings lookup knows whose logs and
 * storage to read for the pools it shows.
 */
export const V4_TRADED_POOLS_QUERY = `query V4TradedPools($from: Int!, $limit: Int!) {
  poolDayDatas(
    where: { date_gte: $from }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    pool {
      ...V4PoolCard
    }
  }
  poolManagers(first: 1) {
    id
  }
  _meta {
    hasIndexingErrors
  }
}

${V4_POOL_CARD_FRAGMENT}`;

/** How many calendar days the window covers, today's unfinished one included. */
export const V4_TRADED_WINDOW_DAYS = 7;

/**
 * How many pool-days to read: the most one request may ask for.
 *
 * Measured to fold into a few hundred pools — a thousand of the week's
 * busiest days named 284 distinct pools on 2026-09-16 — and to arrive in
 * under three seconds, at half a megabyte.
 */
export const V4_TRADED_POOL_DAYS_LIMIT = 1000;

const SECONDS_PER_DAY = 86_400;

/**
 * The first second of the window: midnight UTC, `V4_TRADED_WINDOW_DAYS - 1`
 * days before the day `now` falls in. A `PoolDayData`'s `date` is its day's
 * first second, so `date_gte` this admits every day of the window and none
 * before it.
 */
export const tradedWindowStart = (now: Date): number => {
  const today = Math.floor(now.getTime() / 1000 / SECONDS_PER_DAY) * SECONDS_PER_DAY;

  return today - (V4_TRADED_WINDOW_DAYS - 1) * SECONDS_PER_DAY;
};

const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV4TradedPoolsRequest = {
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly now: () => Date;
  readonly timeoutMs?: number;
};

/** Reads the Ethereum mainnet Uniswap v4 pools that traded the most this week. No caller input to validate. */
export const fetchEthereumV4TradedPools = async (
  request: EthereumV4TradedPoolsRequest,
): Promise<DataResult<V4PoolCandidateList>> => {
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
   * The chain is not asked here. Two hundred and fifty pools is more than the
   * endpoint's budget will answer for in one go, and this list is a net rather
   * than a page: a holdings lookup reads the chain for the few pools it will
   * actually show, once it knows which those are. Every pool here is published
   * with its fee unread, and the manager to ask travels with the list.
   */
  return normalizeV4TradedPools({
    payload: transport.payload,
    fetchedAt: now.toISOString(),
  });
};
