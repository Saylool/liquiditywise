/*
 * The chains this application reads pools on, in one place.
 *
 * Pure and client-safe: an id, the slug an address carries (?chain=base), and
 * the name the chain goes by. Which subgraph and which RPC endpoint serve each
 * one is server-side configuration, next door in chainEnvironment.ts.
 *
 * Ethereum is the default and stays the default: an address with no chain in
 * it is a mainnet address, as every link published before this file was.
 */

export const CHAINS = [
  { id: 1, slug: "ethereum", name: "Ethereum" },
  { id: 8453, slug: "base", name: "Base" },
  { id: 42161, slug: "arbitrum", name: "Arbitrum One" },
] as const;

export type Chain = (typeof CHAINS)[number];
export type ChainId = Chain["id"];
export type ChainSlug = Chain["slug"];

export const ETHEREUM: Chain = CHAINS[0];

export const SUPPORTED_CHAIN_IDS: readonly number[] = CHAINS.map(({ id }) => id);

export const isSupportedChainId = (value: unknown): value is ChainId =>
  typeof value === "number" && SUPPORTED_CHAIN_IDS.includes(value);

export const chainById = (id: ChainId): Chain => CHAINS.find((chain) => chain.id === id)!;

/** The chain a slug names, or `null` for any other text: an unknown chain is refused, never read as mainnet. */
export const chainBySlug = (slug: string): Chain | null => CHAINS.find((chain) => chain.slug === slug) ?? null;

/** The chain a figure's pool names; a pool can only carry a readable chain, so the fallback is never reached in practice. */
export const chainOf = (id: number): Chain => (isSupportedChainId(id) ? chainById(id) : ETHEREUM);
