import { describe, expect, it } from "vitest";

import {
  depthInEth,
  V4_POOL_SEARCH_RESULT_LIMIT,
  type V4PoolSearchMatch,
  V4PoolSearchResultsSchema,
} from "./v4PoolSearch";

const FETCHED_AT = "2026-09-15T14:00:00.000Z";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;

/** The ETH/USDC pool at its live price: 2453 USDC per ETH, as Q64.96. */
const SQRT_PRICE_ETH_USDC = "3916044149203074036022610";

const match = ({
  id,
  liquidity,
  symbols = ["USDC", "WETH"],
  exact = 2,
  state = "read",
}: {
  id: number;
  liquidity: string;
  symbols?: readonly [string, string];
  exact?: number;
  state?: "read" | "unread";
}): V4PoolSearchMatch => ({
  pool: {
    protocolVersion: "v4",
    chainId: 1,
    id: poolId(id),
    token0: { chainId: 1, address: USDC, symbol: symbols[0], decimals: 6 },
    token1: { chainId: 1, address: WETH, symbol: symbols[1], decimals: 18 },
    tickSpacing: 10,
    fee: { kind: "static", feePpm: 250 },
    hookAddress: null,
  },
  /* USDC per WETH ≈ 2500: sqrt(1/2500 · 10^12) · 2^96. */
  state: state === "read" ? { liquidity, sqrtPriceX96: "1584563250285286751870879006" } : null,
  ethPrice: { token0: 0.0004, token1: 1 },
  exactSymbolMatches: exact,
});

const results = (matches: readonly V4PoolSearchMatch[], terms: readonly string[] = ["usdc", "weth"]) =>
  V4PoolSearchResultsSchema.safeParse({
    terms,
    fetchedAt: FETCHED_AT,
    source: "uniswap-v4-subgraph",
    matches,
  });

describe("depthInEth", () => {
  /*
   * The virtual reserves of the live ETH/USDC pool: L = 871594992723282798 at
   * the price the chain held. `L / √P` of ether and `L · √P` of USDC, valued at
   * the source's prices, come to a figure a few percent either side of what the
   * indexer reported the pool holding — which is the sanity check, not the
   * claim: depth and holdings are different quantities.
   */
  it("values the active liquidity at the current price", () => {
    const depth = depthInEth({
      pool: { token0: { decimals: 18 }, token1: { decimals: 6 } },
      state: { liquidity: "871594992723282798", sqrtPriceX96: SQRT_PRICE_ETH_USDC },
      ethPrice: { token0: 1, token1: 1 / 2453 },
    });

    // ≈ 17,633 ETH of ether-side depth plus the same again in USDC.
    expect(depth).toBeGreaterThan(35_000);
    expect(depth).toBeLessThan(35_400);
  });

  it("is zero for a pool with no active liquidity, which is a real answer", () => {
    expect(depthInEth(match({ id: 1, liquidity: "0" }))).toBe(0);
  });

  it("is unknown when the chain was not read", () => {
    expect(depthInEth(match({ id: 1, liquidity: "1", state: "unread" }))).toBeNull();
  });

  it("is unknown when the source gave no price", () => {
    expect(depthInEth({ ...match({ id: 1, liquidity: "1" }), ethPrice: null })).toBeNull();
  });
});

describe("V4PoolSearchResultsSchema", () => {
  /*
   * Exact matches first — an unread exact match still outranks a read partial
   * one — then depth, then the unread. The fixture's first version put the
   * partial match above the unread exact one, and the schema refused it, which
   * is the schema being right about the order it was written to enforce.
   */
  it("accepts a correctly ordered list", () => {
    const parsed = results([
      match({ id: 1, liquidity: "2000" }),
      match({ id: 2, liquidity: "1000" }),
      match({ id: 4, liquidity: "999", state: "unread" }),
      match({ id: 3, liquidity: "1", exact: 1, symbols: ["USDC", "aEthWETH"] }),
    ]);

    expect(parsed.success).toBe(true);
  });

  it("refuses the same pool twice", () => {
    expect(results([match({ id: 1, liquidity: "1" }), match({ id: 1, liquidity: "1" })]).success).toBe(false);
  });

  it("refuses a score that does not follow from the terms", () => {
    expect(results([match({ id: 1, liquidity: "1", exact: 0 })]).success).toBe(false);
  });

  it("refuses a shallower pool above a deeper one", () => {
    expect(results([match({ id: 1, liquidity: "1" }), match({ id: 2, liquidity: "2" })]).success).toBe(false);
  });

  it("refuses a partial match above an exact one", () => {
    expect(
      results([
        match({ id: 1, liquidity: "9", exact: 1, symbols: ["USDC", "aEthWETH"] }),
        match({ id: 2, liquidity: "1" }),
      ]).success,
    ).toBe(false);
  });

  /* An unread pool has no place in a size order, so it may only trail. */
  it("refuses an unread pool above a read one", () => {
    expect(
      results([match({ id: 1, liquidity: "1", state: "unread" }), match({ id: 2, liquidity: "0" })]).success,
    ).toBe(false);
  });

  it("refuses a zero price, which is a slot nobody wrote", () => {
    const zeroPrice = { ...match({ id: 1, liquidity: "1" }), state: { liquidity: "1", sqrtPriceX96: "0" } };

    expect(results([zeroPrice]).success).toBe(false);
  });

  it("refuses more pools than were asked for", () => {
    const many = Array.from({ length: V4_POOL_SEARCH_RESULT_LIMIT + 1 }, (_u, index) =>
      match({ id: index + 1, liquidity: "1" }),
    );

    expect(results(many).success).toBe(false);
  });

  it("refuses the v3 source", () => {
    expect(
      V4PoolSearchResultsSchema.safeParse({
        terms: ["usdc"],
        fetchedAt: FETCHED_AT,
        source: "uniswap-v3-subgraph",
        matches: [],
      }).success,
    ).toBe(false);
  });
});
