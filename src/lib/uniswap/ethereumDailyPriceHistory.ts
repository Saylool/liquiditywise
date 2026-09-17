import type { DataResult, PoolDailyPriceHistory, ProtocolVersion } from "../../schemas";
import {
  DAILY_HISTORY_DAYS,
  resolveDailyHistoryWindow,
} from "./v3DailyHistoryWindow";
import { normalizeDailyPriceHistory } from "./dailyPriceHistoryAdapter";
import { poolIdentityFor } from "./subgraphPoolIdentity";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * The pool id is passed twice, as two variables, because the generated
 * Subgraph API wants two different scalars for the same value: a singular entity
 * lookup always takes `id: ID!`, while a filter on an entity-reference field takes
 * the referenced entity's id scalar, which graph-node renders as `String` for both
 * `String` and `Bytes` ids. Splicing the id into the query text would avoid
 * the duplication and reintroduce an injection surface, so it stays a variable.
 *
 * `date` is `Int!` on `PoolDayData`, hence `Int!` bounds.
 *
 * The top-level `pool { id }` is requested so an unknown pool is distinguishable
 * from a known pool with no indexed days. Each daily row repeats `pool { id }` so
 * its ownership can be verified individually: a filter is a request, not proof of
 * what came back. `first` caps the result at the window size, which is why no
 * `skip` pagination is needed.
 *
 * One query serves both protocols, for the same reason the snapshot query does:
 * the v4 subgraph publishes `PoolDayData` under the same names, with the same
 * inverted extremes, verified by introspection against the deployed schema.
 */
export const DAILY_PRICE_HISTORY_QUERY = `query PoolDailyPriceHistory(
  $poolId: ID!
  $poolRef: String!
  $rangeStart: Int!
  $rangeEndExclusive: Int!
  $dayLimit: Int!
) {
  pool(id: $poolId) {
    id
  }
  poolDayDatas(
    where: { pool: $poolRef, date_gte: $rangeStart, date_lt: $rangeEndExclusive }
    orderBy: date
    orderDirection: asc
    first: $dayLimit
  ) {
    id
    date
    token1Price
    high
    low
    volumeUSD
    feesUSD
    liquidity
    pool {
      id
    }
  }
  _meta {
    block {
      number
      timestamp
    }
    hasIndexingErrors
  }
}`;

const INVALID_POOL_ID = "invalid-pool-address";
const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumDailyPriceHistoryRequest = {
  /** Which protocol's subgraph is being read, and therefore how `poolId` is spelled. */
  readonly protocolVersion: ProtocolVersion;
  /** A v3 pool address or a v4 PoolId, validated here against its protocol. */
  readonly poolId: string;
  /** Raw environment values; validated here so the wrapper stays free of logic. */
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  /** Injected clock. Fixes both `fetchedAt` and the UTC day window. */
  readonly now: () => Date;
  readonly timeoutMs?: number;
};

/**
 * Reads the previous 31 completed UTC days of closing prices for one Ethereum
 * mainnet Uniswap pool.
 *
 * Validation order matches the snapshot reader: caller input first, then server
 * configuration, and neither reaches the network.
 *
 * The injected clock is read twice, and deliberately so: once before the request
 * to fix the UTC day window being asked about, and once after the response
 * arrives to stamp `fetchedAt`. They are different facts — what was requested
 * versus when the answer landed — and collapsing them into one reading is what
 * would let a slow request disguise stale data.
 */
export const fetchEthereumDailyPriceHistory = async (
  request: EthereumDailyPriceHistoryRequest,
): Promise<DataResult<PoolDailyPriceHistory>> => {
  const identity = poolIdentityFor(request.protocolVersion, request.poolId);
  if (identity === null) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_POOL_ID };
  }

  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  // Read before the request so the window reflects the day the query asked about.
  const requestedAt = request.now();
  const window = resolveDailyHistoryWindow(requestedAt);

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: DAILY_PRICE_HISTORY_QUERY,
    variables: {
      poolId: identity.id,
      poolRef: identity.id,
      rangeStart: window.rangeStartUnixSeconds,
      rangeEndExclusive: window.rangeEndExclusiveUnixSeconds,
      dayLimit: DAILY_HISTORY_DAYS,
    },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  /*
   * Read again, now that the response is in hand.
   *
   * `fetchedAt` is defined as when the answer arrived, and freshness is measured
   * against it. Reusing the pre-request instant would subtract the request's own
   * duration from the apparent lag, so a slow call would make the source look
   * fresher than it is — and a genuinely stale response could pass the staleness
   * gate purely because the round trip was slow.
   */
  const receivedAt = request.now();

  return normalizeDailyPriceHistory({
    payload: transport.payload,
    identity,
    fetchedAt: receivedAt.toISOString(),
    window,
  });
};
