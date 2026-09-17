import type { DataResult } from "../../schemas";
import { V4_POOL_CARD_FRAGMENT } from "./v4PoolCardRawResponse";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/*
 * The one list of v4 pools this application can get, read once for everyone
 * who needs it.
 *
 * Two pages are built from it. A holdings lookup draws its candidate currencies
 * from these pools, and a v4 search matches its terms against them — because
 * the source cannot answer a search at all: every `pools` query ordered by
 * volume, and every one filtered by a token's symbol, was answered by the
 * gateway with fifteen seconds of silence and then an error naming both of the
 * subgraph's indexers as bad. What the same gateway answers in under a second
 * is the day table filtered by date, so that is what is asked, and the
 * searching and the netting both happen here rather than there.
 *
 * Not the v3 query. `pools` ordered by volume — with the v3 transaction filter,
 * without it, by transaction count instead, for two hundred and fifty or for
 * fifty — met the same refusal on 2026-09-16, whichever variant was sent.
 *
 * So the net is the busiest pool-days of the last week, and the pools those
 * days belong to. A pool that traded heavily on any day of the window is in;
 * one that traded on none is not, which is a narrower claim than the v3 list's
 * all-time volume and the one the pages state.
 *
 * What this list adds that the v3 one cannot is the chain's own ether. A v4
 * pool may hold it as a currency, under the zero address, and an address that
 * holds ether — every address that has ever paid for gas — has a side of every
 * such pool already.
 *
 * `poolManagers` is asked for so a lookup knows whose logs and storage to read
 * for the pools it shows.
 */
export const V4_POOL_DAYS_QUERY = `query V4PoolDays($from: Int!, $limit: Int!) {
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
export const V4_POOL_DAYS_WINDOW = 7;

/**
 * How many pool-days to read: the most one request may ask for.
 *
 * Measured to fold into a few hundred pools — a thousand of the week's
 * busiest days named 284 distinct pools on 2026-09-16 — and to arrive in
 * under three seconds, at half a megabyte.
 */
export const V4_POOL_DAYS_LIMIT = 1000;

const SECONDS_PER_DAY = 86_400;

/**
 * The first second of the window: midnight UTC, `V4_POOL_DAYS_WINDOW - 1` days
 * before the day `now` falls in. A `PoolDayData`'s `date` is its day's first
 * second, so `date_gte` this admits every day of the window and none before it.
 */
export const poolDaysWindowStart = (now: Date): number => {
  const today = Math.floor(now.getTime() / 1000 / SECONDS_PER_DAY) * SECONDS_PER_DAY;

  return today - (V4_POOL_DAYS_WINDOW - 1) * SECONDS_PER_DAY;
};

/**
 * One read of the day table, still untrusted, with the moment it was read.
 *
 * The timestamp travels with the payload rather than being taken at the point
 * of use, because a read of this is shared for as long as ten minutes: a page
 * stamping its own render time on it would say the figures were fresher than
 * they are.
 */
export type V4PoolDays = {
  /** The decoded JSON body. Every consumer validates it through its own schema. */
  readonly payload: unknown;
  readonly fetchedAt: string;
};

const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV4PoolDaysRequest = {
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly now: () => Date;
  readonly timeoutMs?: number;
};

/** Reads the week's busiest v4 pool-days. No caller input to validate. */
export const fetchEthereumV4PoolDays = async (
  request: EthereumV4PoolDaysRequest,
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
    query: V4_POOL_DAYS_QUERY,
    variables: { from: poolDaysWindowStart(now), limit: V4_POOL_DAYS_LIMIT },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return { status: "success", data: { payload: transport.payload, fetchedAt: now.toISOString() } };
};

/** How a page asks for the day table: a function, so nothing is read until it is needed. */
export type ReadV4PoolDays = () => Promise<DataResult<V4PoolDays>>;
