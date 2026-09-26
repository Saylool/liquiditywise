import "server-only";

import { type ChainId, readsV4, type V4ChainId } from "./chains";

/*
 * Which subgraph and which RPC endpoint serve each chain, read from the
 * environment on every call so a changed .env.local needs only a restart.
 *
 * `satisfies Record<ChainId, …>` is what makes a chain added to chains.ts
 * without its configuration a compile error here, rather than a reader that
 * quietly asks the mainnet subgraph about a pool on another chain — which
 * would answer, well-formed, about whatever sits at that address on mainnet.
 */

const V3_SUBGRAPH = {
  1: () => process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
  8453: () => process.env.UNISWAP_V3_BASE_SUBGRAPH_ID,
  42161: () => process.env.UNISWAP_V3_ARBITRUM_SUBGRAPH_ID,
} as const satisfies Record<ChainId, () => string | undefined>;

const V4_SUBGRAPH = {
  1: () => process.env.UNISWAP_V4_ETHEREUM_SUBGRAPH_ID,
  42161: () => process.env.UNISWAP_V4_ARBITRUM_SUBGRAPH_ID,
} as const satisfies Record<V4ChainId, () => string | undefined>;

const RPC = {
  1: () => process.env.ETHEREUM_RPC_URL,
  8453: () => process.env.BASE_RPC_URL,
  42161: () => process.env.ARBITRUM_RPC_URL,
} as const satisfies Record<ChainId, () => string | undefined>;

export const v3SubgraphIdFor = (chainId: ChainId): string | undefined => V3_SUBGRAPH[chainId]();

/** The v4 subgraph on a chain; on a chain v4 is not read on there is none, never mainnet's. */
export const v4SubgraphIdFor = (chainId: ChainId): string | undefined =>
  readsV4(chainId) ? V4_SUBGRAPH[chainId]() : undefined;

/**
 * The subgraph for one protocol on one chain. Asked for v4 on a chain it is
 * not read on, there is none, and the read reports itself unconfigured rather
 * than asking mainnet's.
 */
export const subgraphIdFor = (protocolVersion: "v3" | "v4", chainId: ChainId): string | undefined =>
  protocolVersion === "v3" ? v3SubgraphIdFor(chainId) : v4SubgraphIdFor(chainId);

export const rpcUrlFor = (chainId: ChainId): string | undefined => RPC[chainId]();
