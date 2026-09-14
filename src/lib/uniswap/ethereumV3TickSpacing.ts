import { type DataResult, nonZeroEvmAddress } from "../../schemas";
import { DEFAULT_RPC_TIMEOUT_MS, postEthCall } from "./ethereumRpcTransport";
import { normalizeV3TickSpacing, TICK_SPACING_CALLDATA } from "./v3TickSpacingAdapter";
import type { FetchLike } from "./v3SubgraphTransport";

const INVALID_ADDRESS = "invalid-pool-address";
const NOT_CONFIGURED = "chain-data-not-configured";

/** Shared with the other v3 readers: no v3 pool is ever deployed at address zero. */
const PoolAddressSchema = nonZeroEvmAddress(INVALID_ADDRESS);

export type EthereumV3TickSpacingRequest = {
  readonly poolAddress: string;
  /** Raw environment value; validated here so the wrapper stays free of logic. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/**
 * Reads one Ethereum mainnet Uniswap v3 pool's tick spacing directly from the
 * pool contract.
 *
 * This exists because no Uniswap subgraph exposes `tickSpacing` — not the `Pool`
 * entity, not `Factory`, not the tokens subgraph. The alternative would be a
 * hardcoded fee-tier-to-spacing table, which this project refuses: governance can
 * enable nonstandard tiers with their own spacing, and a stale table would
 * misalign a position's bounds without any visible error.
 *
 * Read-only. The transport can issue `eth_call` and nothing else; there is no
 * signing and no account access anywhere in this path.
 *
 * Validation order matches the subgraph readers: caller input first, then server
 * configuration, and neither reaches the network.
 */
export const fetchEthereumV3TickSpacing = async (
  request: EthereumV3TickSpacingRequest,
): Promise<DataResult<number>> => {
  const address = PoolAddressSchema.safeParse(request.poolAddress);
  if (!address.success) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_ADDRESS };
  }

  const rpcUrl = request.rpcUrl?.trim();
  if (rpcUrl === undefined || rpcUrl === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const transport = await postEthCall({
    rpcUrl,
    to: address.data,
    data: TICK_SPACING_CALLDATA,
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return normalizeV3TickSpacing(transport.payload);
};
