import { Bytes32HexSchema, type DataResult, type V4Pool } from "../../schemas";
import { normalizeV4Pool } from "./v4PoolAdapter";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * One Uniswap v4 pool, by its PoolId.
 *
 * Shorter than the v3 equivalent by one whole read. A v3 pool's tick spacing
 * appears in no subgraph and has to come from the pool contract; a v4 pool's is
 * part of the PoolKey the id is derived from, so it arrives with everything
 * else. There is no `eth_call` on this path at all.
 *
 * `hooks` is the field that has no v3 counterpart, and it is the one that
 * changes what the rest of an analysis can claim.
 */
export const V4_POOL_QUERY = `query V4Pool($poolId: ID!) {
  pool(id: $poolId) {
    id
    feeTier
    tickSpacing
    hooks
    token0 {
      id
      symbol
      name
      decimals
    }
    token1 {
      id
      symbol
      name
      decimals
    }
  }
  _meta {
    hasIndexingErrors
  }
}`;

const INVALID_POOL_ID = "invalid-pool-address";
const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV4PoolRequest = {
  /** A 32-byte PoolId, not an address: v4 pools live inside one contract. */
  readonly poolId: string;
  /** Raw environment values; validated here so the wrapper stays free of logic. */
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/**
 * Reads one Ethereum mainnet Uniswap v4 pool's fixed configuration.
 *
 * No clock is injected, because nothing here is time-dependent: a PoolKey is
 * settled when the pool is initialised and never changes. What a *hook* does may
 * change at any moment — but what it is permitted to do is fixed in its address,
 * and that is the only claim this read makes about it.
 *
 * Validation order matches every other reader: caller input first, then server
 * configuration, and neither reaches the network.
 */
export const fetchEthereumV4Pool = async (
  request: EthereumV4PoolRequest,
): Promise<DataResult<V4Pool>> => {
  const poolId = Bytes32HexSchema.safeParse(request.poolId);
  if (!poolId.success) {
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
    query: V4_POOL_QUERY,
    variables: { poolId: poolId.data },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return normalizeV4Pool({ payload: transport.payload, poolId: poolId.data });
};
