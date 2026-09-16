import { Bytes32HexSchema, type DataResult, type V4Pool } from "../../schemas";
import { fetchEthereumV4PoolChain } from "./ethereumV4PoolChain";
import { normalizeV4Pool, readV4PoolEnvelope } from "./v4PoolAdapter";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * One Uniswap v4 pool, by its PoolId: the indexer's record of it, and then
 * the chain's.
 *
 * The indexer is asked for the pool's identity and where it was created; the
 * chain is asked for the key the pool was created with and the fees its state
 * holds. The fee is not asked of the indexer at all — its `feeTier` was
 * measured to be the total fee of the latest swap rather than the key's fee —
 * so, like the v3 read, this one is two sources reconciled into one pool.
 *
 * `hooks` is the field that has no v3 counterpart, and it is the one that
 * changes what the rest of an analysis can claim.
 */
export const V4_POOL_QUERY = `query V4Pool($poolId: ID!) {
  pool(id: $poolId) {
    id
    createdAtBlockNumber
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
  poolManagers(first: 1) {
    id
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
  /** Ethereum JSON-RPC endpoint, for the key and the fees. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/**
 * Reads one Ethereum mainnet Uniswap v4 pool's configuration from both sources.
 *
 * No clock is injected, because nothing here is time-dependent: a PoolKey is
 * settled when the pool is initialised and never changes, and the protocol's
 * cut changes only when governance moves it. What a *hook* does may change at
 * any moment — but what it is permitted to do is fixed in its address, and
 * that is the only claim this read makes about it.
 *
 * Validation order matches every other reader: caller input first, then server
 * configuration, and neither reaches the network. The chain is asked after the
 * indexer rather than alongside it, because the indexer says which block to
 * ask about.
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

  const envelope = readV4PoolEnvelope(transport.payload);
  if (!envelope.ok) return envelope.result;

  const chain = await fetchEthereumV4PoolChain({
    poolId: poolId.data,
    createdAtBlockNumber: envelope.raw.createdAtBlockNumber,
    poolManager: envelope.poolManager,
    rpcUrl: request.rpcUrl,
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs,
  });
  if (chain.status === "unavailable") return chain;

  return normalizeV4Pool({ payload: transport.payload, poolId: poolId.data, chain: chain.data });
};
