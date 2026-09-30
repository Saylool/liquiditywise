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
  { id: 1, slug: "ethereum", name: "Ethereum", v3: true, v3Search: "pools", v3Pairs: "pools", v4: true, v4Pairs: "pools", v3Positions: true, native: "ETH" },
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
  /*
   * `v3Pairs: "days"` for the same reason: Base's v3 pair query answered in
   * 10.5 to 14.5 seconds on 2026-09-25, and still took ten on 2026-09-27.
   */
  { id: 8453, slug: "base", name: "Base", v3: true, v3Search: "days", v3Pairs: "days", v4: true, v4Pairs: "days", v3Positions: true, native: "ETH" },
  { id: 42161, slug: "arbitrum", name: "Arbitrum One", v3: true, v3Search: "pools", v3Pairs: "pools", v4: true, v4Pairs: "pools", v3Positions: false, native: "ETH" },
  /*
   * v4 alone. Uniswap's own chain, where the week's trading is v4's: its v4
   * subgraph answered the day table in half a second, two seconds behind the
   * chain, with the PoolManager Uniswap publishes for it (measured
   * 2026-09-27). The one public v3 subgraph for it has no indexer serving it.
   * `v3Search` and `v3Pairs` are never read where `v3` is false.
   */
  { id: 130, slug: "unichain", name: "Unichain", v3: false, v3Search: "pools", v3Pairs: "pools", v4: true, v4Pairs: "pools", v3Positions: false, native: "ETH" },
  /*
   * OP Mainnet, v3 and v4, from the subgraphs .env.example names (measured
   * 2026-09-27: the week's day table in about a second on each, seconds behind
   * the chain, with the factory and PoolManager Uniswap publishes for it).
   */
  { id: 10, slug: "optimism", name: "OP Mainnet", v3: true, v3Search: "pools", v3Pairs: "pools", v4: true, v4Pairs: "pools", v3Positions: true, native: "ETH" },
  /*
   * Polygon PoS. Its own currency is POL, not ether: a v4 pool's zero address
   * is POL there, and its subgraphs price every token in POL where the others
   * price in ether — which is what `native` is for.
   *
   * `v3Search` and `v3Pairs` are "days" because both public v3 subgraphs for
   * Polygon answered every query that filters or orders pools with "bad
   * indexers" on 2026-09-27, fifteen seconds and more, while their day table
   * answered in three.
   */
  { id: 137, slug: "polygon", name: "Polygon", v3: true, v3Search: "days", v3Pairs: "days", v4: true, v4Pairs: "pools", v3Positions: true, native: "POL" },
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

/** The chains v3 pools are read on. */
export const V3_CHAINS: readonly Chain[] = CHAINS.filter((chain) => chain.v3);

export type V3ChainId = Extract<Chain, { v3: true }>["id"];

/** Whether v3 pools are read on a chain; off it, a v3 page says so rather than asking mainnet. */
export const readsV3 = (chainId: ChainId): chainId is V3ChainId => chainById(chainId).v3;

/**
 * Where the positions inside v3 pools can be listed — which the smart-money
 * page needs and nothing else does. Measured 2026-09-30: mainnet's and
 * Polygon's v3 subgraphs keep positions, and so does a second, separate
 * subgraph on Base and on OP Mainnet — the ones the pool pages read there
 * have no such entity, or refuse the query on a busy pool with "bad
 * indexers". Arbitrum has none that answers: two subgraphs have the entity
 * and reject its filters.
 */
export const readsV3Positions = (chainId: ChainId): chainId is V3PositionChainId => chainById(chainId).v3Positions;

export const V3_POSITION_CHAINS: readonly Chain[] = CHAINS.filter((chain) => chain.v3Positions);

export type V3PositionChainId = Extract<Chain, { v3Positions: true }>["id"];

/** The chains v4 pools are read on. */
export const V4_CHAINS: readonly Chain[] = CHAINS.filter((chain) => chain.v4);

export type V4ChainId = Extract<Chain, { v4: true }>["id"];

/** Whether v4 pools are read on a chain; off it, a v4 page says so rather than asking mainnet. */
export const readsV4 = (chainId: ChainId): chainId is V4ChainId => chainById(chainId).v4;

/** The chain a figure's pool names; a pool can only carry a readable chain, so the fallback is never reached in practice. */
export const chainOf = (id: number): Chain => (isSupportedChainId(id) ? chainById(id) : ETHEREUM);

/** The chain's own currency — what a v4 pool's zero address holds, and what its subgraph prices tokens in. */
export const nativeSymbolOf = (id: number): Chain["native"] => chainOf(id).native;
