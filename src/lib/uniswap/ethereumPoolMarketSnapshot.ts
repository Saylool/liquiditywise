import type { DataResult, PoolMarketSnapshot, ProtocolVersion } from "../../schemas";
import { normalizePoolSnapshot } from "./poolSnapshotAdapter";
import { poolIdentityFor } from "./subgraphPoolIdentity";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * The pool id travels as a GraphQL variable, never spliced into this string.
 * Interpolating caller input into a query is how injection and cache-key bugs
 * start, and it would also put the id in a position where escaping matters.
 *
 * Only the fields a snapshot needs are requested. Notably absent is `volumeUSD`:
 * it is a lifetime cumulative total, and no rolling window can be derived from it
 * in a single reading.
 *
 * One query serves both protocols. The v4 subgraph publishes this entity under
 * the same names as the v3 one — verified by introspection against the deployed
 * schema, not assumed — so what differs between a v3 read and a v4 read is which
 * subgraph the request goes to and how the id is spelled.
 */
export const POOL_SNAPSHOT_QUERY = `query PoolMarketSnapshot($poolId: ID!) {
  pool(id: $poolId) {
    id
    token0Price
    token1Price
    totalValueLockedUSD
    totalValueLockedToken0
    totalValueLockedToken1
    liquidity
    tick
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

export type EthereumPoolSnapshotRequest = {
  /** Which protocol's subgraph is being read, and therefore how `poolId` is spelled. */
  readonly protocolVersion: ProtocolVersion;
  /** A v3 pool address or a v4 PoolId, validated here against its protocol. */
  readonly poolId: string;
  /** Raw environment values; validated here so the wrapper stays free of logic. */
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  /** Injected clock. Its instant becomes `fetchedAt`. */
  readonly now: () => Date;
  readonly timeoutMs?: number;
};

/**
 * Reads one Ethereum mainnet Uniswap pool and returns it as a domain snapshot.
 *
 * Every decision lives here rather than in the server-only wrapper, so the whole
 * flow — validation order, transport, normalization — is testable with an injected
 * fetch and clock and no environment at all.
 *
 * Caller input is checked before configuration: an id that is not one this
 * protocol could name is the caller's problem whatever the server's settings, and
 * reporting it as a configuration fault would send someone to inspect the wrong
 * thing. Neither check reaches the network.
 */
export const fetchEthereumPoolMarketSnapshot = async (
  request: EthereumPoolSnapshotRequest,
): Promise<DataResult<PoolMarketSnapshot>> => {
  const identity = poolIdentityFor(request.protocolVersion, request.poolId);
  if (identity === null) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_POOL_ID };
  }

  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: POOL_SNAPSHOT_QUERY,
    variables: { poolId: identity.id },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return normalizePoolSnapshot({
    payload: transport.payload,
    identity,
    fetchedAt: request.now().toISOString(),
  });
};
