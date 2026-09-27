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
  { id: 1, slug: "ethereum", name: "Ethereum", v3Search: "pools", v4: true, v4Pairs: "pools" },
  /*
   * "days": Base's v3 subgraph answers no query that filters pools by a
   * token's symbol — measured on 2026-09-25, every shape of it failed at the
   * gateway after fifteen seconds with a bad indexer — while its day table
   * answers in six. So a name search there looks through the week's busiest
   * pools, as the v4 search does on mainnet for the same reason.
   */
  /*
   * v4 on both, from the subgraphs .env.example names. Base's was chosen on
   * 2026-09-27 after failing the day before: of its two public v4 subgraphs,
   * one still answered with an indexing error and the other answered the
   * week's day table in 3–4 s, seconds behind the chain, with the PoolManager
   * Uniswap publishes for Base. The health check asks every subgraph hourly
   * (subgraphProbe.ts), because this one has already been down once.
   * A chain marked `v4: false` would have every v4 read refused, never
   * looked up on mainnet.
   */
  /*
   * `v4Pairs: "days"`: Base's v4 subgraph answers the pair query ordered by
   * volume, liquidity or trade count with "bad indexers" after fifteen seconds,
   * and unordered in one to eight — measured on 2026-09-27, the day its pair
   * panel was found timing out on every page. So a v4 page there lists the
   * pair's pools from the week's busiest pool-days, which the warmer keeps.
   */
  { id: 8453, slug: "base", name: "Base", v3Search: "days", v4: true, v4Pairs: "days" },
  { id: 42161, slug: "arbitrum", name: "Arbitrum One", v3Search: "pools", v4: true, v4Pairs: "pools" },
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

/** The chains v4 pools are read on. */
export const V4_CHAINS: readonly Chain[] = CHAINS.filter((chain) => chain.v4);

export type V4ChainId = Extract<Chain, { v4: true }>["id"];

/** Whether v4 pools are read on a chain; off it, a v4 page says so rather than asking mainnet. */
export const readsV4 = (chainId: ChainId): chainId is V4ChainId => chainById(chainId).v4;

/** The chain a figure's pool names; a pool can only carry a readable chain, so the fallback is never reached in practice. */
export const chainOf = (id: number): Chain => (isSupportedChainId(id) ? chainById(id) : ETHEREUM);
