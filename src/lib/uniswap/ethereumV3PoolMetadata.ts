import { type DataResult, nonZeroEvmAddress, type V3PoolMetadata } from "../../schemas";
import { normalizeV3PoolMetadata } from "./v3PoolMetadataAdapter";
import type { ChainId } from "../chains/chains";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * Reads a pool's immutable configuration.
 *
 * Only one variable is needed: unlike the history query there is no
 * entity-reference filter, so the singular lookup's `ID!` is the whole story. The
 * address still travels as a variable rather than spliced into the text.
 *
 * `feeTier` and `decimals` are `BigInt!` in the official schema and arrive as
 * strings. Notably absent is `tickSpacing`, which no Uniswap subgraph exposes.
 */
export const V3_POOL_METADATA_QUERY = `query PoolMetadata($poolId: ID!) {
  pool(id: $poolId) {
    id
    feeTier
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

const INVALID_ADDRESS = "invalid-pool-address";
const NOT_CONFIGURED = "market-data-not-configured";

/** Shared with the other v3 readers: no v3 pool is ever deployed at address zero. */
const PoolAddressSchema = nonZeroEvmAddress(INVALID_ADDRESS);

export type EthereumV3PoolMetadataRequest = {
  readonly poolAddress: string;
  /** The chain the subgraph indexes; mainnet when not said. */
  readonly chainId?: ChainId;
  /** Raw environment values; validated here so the wrapper stays free of logic. */
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/**
 * Reads the verified token ordering, token decimals and fee tier for one Ethereum
 * mainnet Uniswap v3 pool.
 *
 * This is the metadata that price work needs and the normalized snapshot does not
 * carry: which token is `token0`, and how many decimals each side has. It does
 * *not* complete a deployable position — that additionally needs the pool's tick
 * spacing, which is read on-chain rather than from a subgraph.
 *
 * No clock is injected, because nothing here is time-dependent: the answer
 * describes a pool's fixed configuration rather than a moment.
 *
 * Validation order matches the other readers: caller input first, then server
 * configuration, and neither reaches the network.
 */
export const fetchEthereumV3PoolMetadata = async (
  request: EthereumV3PoolMetadataRequest,
): Promise<DataResult<V3PoolMetadata>> => {
  const address = PoolAddressSchema.safeParse(request.poolAddress);
  if (!address.success) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_ADDRESS };
  }

  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: V3_POOL_METADATA_QUERY,
    variables: { poolId: address.data },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return normalizeV3PoolMetadata({
    payload: transport.payload,
    poolAddress: address.data,
    chainId: request.chainId ?? 1,
  });
};
