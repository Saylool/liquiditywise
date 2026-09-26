import type { ChainId } from "../chains/chains";
import {
  Bytes32HexSchema,
  type DataResult,
  EvmAddressSchema,
  V4_PAIR_POOL_FETCH_LIMIT,
  type V4PairPools,
} from "../../schemas";
import { fetchEthereumV4PoolKeys } from "./ethereumV4PoolKeys";
import { fetchEthereumV4PoolStates } from "./ethereumV4PoolState";
import { V4_POOL_CARD_FRAGMENT } from "./v4PoolCardRawResponse";
import { normalizeV4PairPools, readV4PairPools } from "./v4PairPoolsAdapter";
import { hookedRefs } from "./v4PoolSearchAdapter";
import type { PairFeeTiersDiagnostic } from "./v3PairFeeTiersAdapter";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * Every v4 pool of one currency pair, by the pair's two addresses in the pool's
 * own order — the zero address included, which is how v4 spells native ether.
 *
 * Ordered by traded volume for the window only; what the reader sees is
 * ordered by depth read from the chain. `poolManagers` is asked for in the
 * same request so that read knows whose storage to open, as with the search.
 */
export const V4_PAIR_POOLS_QUERY = `query V4PairPools($token0: String!, $token1: String!, $limit: Int!) {
  pools(
    where: { token0: $token0, token1: $token1 }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...V4PoolCard
  }
  poolManagers(first: 1) {
    id
  }
  _meta {
    hasIndexingErrors
  }
}

${V4_POOL_CARD_FRAGMENT}`;

const INVALID_INPUT = "invalid-pool-address";
const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV4PairPoolsRequest = {
  /** The v4 pool being read, or `null` when the pair comes from a v3 pool's page. */
  readonly analysedPoolId: string | null;
  /** The pair, in address order. Either may be the zero address. */
  readonly token0Address: string;
  readonly token1Address: string;
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly now: () => Date;
  readonly timeoutMs?: number;
  /** The chain the subgraph and the endpoint are on; mainnet when not said. */
  readonly chainId?: ChainId;
  readonly onDiagnostic?: PairFeeTiersDiagnostic | undefined;
};

/**
 * Reads every Uniswap v4 pool, on one chain, that trades one currency pair,
 * and asks the PoolManager what each one's depth is.
 *
 * Validation order matches every other reader: caller input first, then
 * configuration, and neither reaches the network. A deployment with no v4
 * subgraph gets the same not-configured answer the v4 search gets.
 */
export const fetchEthereumV4PairPools = async (
  request: EthereumV4PairPoolsRequest,
): Promise<DataResult<V4PairPools>> => {
  const analysed =
    request.analysedPoolId === null
      ? { success: true as const, data: null }
      : Bytes32HexSchema.safeParse(request.analysedPoolId);
  const token0 = EvmAddressSchema.safeParse(request.token0Address);
  const token1 = EvmAddressSchema.safeParse(request.token1Address);
  if (!analysed.success || !token0.success || !token1.success || token0.data >= token1.data) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_INPUT };
  }

  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: V4_PAIR_POOLS_QUERY,
    variables: { token0: token0.data, token1: token1.data, limit: V4_PAIR_POOL_FETCH_LIMIT },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  /* The key decides each pool's fee; the state decides the order. Read together. */
  const { pools, poolManager } = readV4PairPools(transport.payload);
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

  return normalizeV4PairPools({
    payload: transport.payload,
    states,
    keys,
    analysedPoolId: analysed.data,
    fetchedAt: request.now().toISOString(),
    chainId: request.chainId ?? 1,
    onDiagnostic: request.onDiagnostic,
  });
};
