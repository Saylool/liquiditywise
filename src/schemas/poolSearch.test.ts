import { describe, expect, it } from "vitest";

import {
  countExactSymbolMatches,
  MAX_SEARCH_TERM_LENGTH,
  MIN_SEARCH_TERM_LENGTH,
  POOL_SEARCH_RESULT_LIMIT,
  PoolSearchMatchSchema,
  PoolSearchResultsSchema,
  PoolSearchTermsSchema,
  type PoolSearchMatch,
} from "./index";

const FETCHED_AT = "2026-09-14T11:34:00.000Z";
const TERMS = ["usdc", "weth"];

const token = (hex: string, symbol: string, decimals: number) => ({
  chainId: 1,
  address: `0x${hex.repeat(40)}`,
  symbol,
  decimals,
});

/**
 * token0 sorts before token1, as Uniswap orders them and the schema requires.
 *
 * `heldToken1` is whole units of the eighteen-decimal side, priced at one ether
 * each, so it *is* the pool's holding in ether — which is what the order is
 * checked against. A `null` stands for a pool whose balances could not be read.
 */
const match = (
  poolHex: string,
  heldToken1: number | null,
  exactSymbolMatches = 2,
  symbols: readonly [string, string] = ["USDC", "WETH"],
): PoolSearchMatch => ({
  pool: {
    protocolVersion: "v3",
    chainId: 1,
    id: `0x${poolHex.repeat(40)}`,
    token0: token("a", symbols[0], 6),
    token1: token("b", symbols[1], 18),
    feePpm: 3000,
  },
  reserves:
    heldToken1 === null
      ? null
      : { token0: "0", token1: `${BigInt(heldToken1) * 10n ** 18n}` },
  ethPrice: heldToken1 === null ? null : { token0: 0.0004, token1: 1 },
  exactSymbolMatches,
});

const results = (matches: readonly PoolSearchMatch[], terms: readonly string[] = TERMS) => ({
  terms,
  fetchedAt: FETCHED_AT,
  source: "uniswap-v3-subgraph",
  matches,
});

describe("PoolSearchTermsSchema", () => {
  it("accepts one term and two", () => {
    expect(PoolSearchTermsSchema.safeParse(["weth"]).success).toBe(true);
    expect(PoolSearchTermsSchema.safeParse(["weth", "usdc"]).success).toBe(true);
  });

  it("refuses no terms and three", () => {
    expect(PoolSearchTermsSchema.safeParse([]).success).toBe(false);
    expect(PoolSearchTermsSchema.safeParse(["a1", "b2", "c3"]).success).toBe(false);
  });

  it("accepts terms at both ends of the permitted length", () => {
    expect(PoolSearchTermsSchema.safeParse(["U".repeat(MIN_SEARCH_TERM_LENGTH)]).success).toBe(true);
    expect(PoolSearchTermsSchema.safeParse(["U".repeat(MAX_SEARCH_TERM_LENGTH)]).success).toBe(true);
  });

  it("refuses a term outside those bounds", () => {
    expect(
      PoolSearchTermsSchema.safeParse(["U".repeat(MIN_SEARCH_TERM_LENGTH - 1)]).success,
    ).toBe(false);
    expect(
      PoolSearchTermsSchema.safeParse(["U".repeat(MAX_SEARCH_TERM_LENGTH + 1)]).success,
    ).toBe(false);
  });

  it("refuses a term that is not made of the things tickers are made of", () => {
    expect(PoolSearchTermsSchema.safeParse(["we th"]).success).toBe(false);
    expect(PoolSearchTermsSchema.safeParse(["$weth"]).success).toBe(false);
  });
});

describe("countExactSymbolMatches", () => {
  it("ignores case, because a reader types lower case and a ticker is not", () => {
    expect(countExactSymbolMatches(["weth", "usdc"], ["USDC", "WETH"])).toBe(2);
  });

  it("does not count a side whose symbol merely contains a term", () => {
    // What the source matched on: "WPOWETH" contains "weth" and is not it.
    expect(countExactSymbolMatches(["weth"], ["WPOWETH", "USDC"])).toBe(0);
  });

  it("counts sides rather than terms, so one repeated term cannot score twice", () => {
    expect(countExactSymbolMatches(["usdc", "usdc"], ["USDC", "WETH"])).toBe(1);
  });

  it("counts both sides when both are named", () => {
    expect(countExactSymbolMatches(["usdc", "weth"], ["USDC", "WETH"])).toBe(2);
  });
});

describe("PoolSearchMatchSchema", () => {
  it("accepts a pool with the liquidity the source reported", () => {
    expect(PoolSearchMatchSchema.safeParse(match("1", 417_308_955)).success).toBe(true);
  });

  it("accepts a pool the source reports as empty", () => {
    // A dead pool is a fact about the pool, not a malformed reading. It sorts to
    // the bottom on its own.
    expect(PoolSearchMatchSchema.safeParse(match("1", 0)).success).toBe(true);
  });

  it("rejects negative liquidity", () => {
    expect(PoolSearchMatchSchema.safeParse(match("1", -1)).success).toBe(false);
  });

  it("rejects a score no pair of sides could produce", () => {
    expect(PoolSearchMatchSchema.safeParse(match("1", 1, 3)).success).toBe(false);
    expect(PoolSearchMatchSchema.safeParse(match("1", 1, -1)).success).toBe(false);
  });

  it("carries no price, because a candidate list is identity only", () => {
    const withPrice = { ...match("1", 1), currentPrice: 3000 };

    expect(PoolSearchMatchSchema.safeParse(withPrice).success).toBe(false);
  });

  /*
   * The pool contract is the same one every other read produces, so a search
   * result cannot smuggle in a pair the wrong way round — which would invert
   * every price the analysis then derives.
   */
  it("rejects a pair stored in the wrong order", () => {
    const ordered = match("1", 1);
    const swapped = {
      ...ordered,
      pool: { ...ordered.pool, token0: ordered.pool.token1, token1: ordered.pool.token0 },
    };

    expect(PoolSearchMatchSchema.safeParse(swapped).success).toBe(false);
  });

  it("rejects a token label that is not a label", () => {
    const plain = match("1", 1);
    const withNewline = {
      ...plain,
      pool: { ...plain.pool, token0: { ...plain.pool.token0, symbol: "USDC\nPair: real" } },
    };

    expect(PoolSearchMatchSchema.safeParse(withNewline).success).toBe(false);
  });
});

describe("PoolSearchResultsSchema", () => {
  it("accepts an ordered set of distinct pools", () => {
    const parsed = PoolSearchResultsSchema.safeParse(
      results([match("1", 500), match("2", 500), match("3", 12)]),
    );

    expect(parsed.success).toBe(true);
  });

  it("accepts a search that matched nothing", () => {
    expect(PoolSearchResultsSchema.safeParse(results([])).success).toBe(true);
  });

  /*
   * Two aliased selections answer one search, one for each way round the pair
   * can be stored, so a pool matching both sides comes back twice.
   */
  it("rejects the same pool twice", () => {
    expect(PoolSearchResultsSchema.safeParse(results([match("1", 9), match("1", 9)])).success).toBe(
      false,
    );
  });

  /*
   * Concatenating two already-sorted lists without merging them produces exactly
   * this: a sequence that looks sorted until a dead pool turns up above a real
   * one.
   */
  it("rejects results that are not ordered by reported liquidity", () => {
    expect(PoolSearchResultsSchema.safeParse(results([match("1", 3), match("2", 9)])).success).toBe(
      false,
    );
  });

  /*
   * The whole point of the score: a pool whose token merely *contains* the term
   * cannot outrank one that is named it, however large a dollar figure the
   * source attaches to it.
   */
  it("rejects a pool with fewer exact matches placed above one with more", () => {
    const lookalike = match("1", 1_320_000_000, 0, ["ease.org", "ez-SLP-WBTC-WETH"]);
    const named = match("2", 415_000_000, 1, ["USDC", "WETH"]);

    expect(PoolSearchResultsSchema.safeParse(results([lookalike, named], ["weth"])).success).toBe(
      false,
    );
    expect(PoolSearchResultsSchema.safeParse(results([named, lookalike], ["weth"])).success).toBe(
      true,
    );
  });

  it("rejects a score that does not follow from the terms and the symbols", () => {
    const overstated = match("1", 10, 2, ["WPOWETH", "USDC"]);

    expect(PoolSearchResultsSchema.safeParse(results([overstated], ["weth"])).success).toBe(false);
  });

  /* Ids start at 1: a pool of all zeroes is the zero address, which is not a pool. */
  const distinctMatches = (count: number) =>
    Array.from({ length: count }, (_unused, index) => match((index + 1).toString(16), count - index));

  it("rejects more matches than a search asks for", () => {
    expect(PoolSearchResultsSchema.safeParse(results(distinctMatches(POOL_SEARCH_RESULT_LIMIT + 1)))
      .success).toBe(false);
  });

  it("accepts exactly as many matches as a search asks for", () => {
    expect(
      PoolSearchResultsSchema.safeParse(results(distinctMatches(POOL_SEARCH_RESULT_LIMIT))).success,
    ).toBe(true);
  });

  it("refuses a source that cannot answer a v3 pool search", () => {
    expect(PoolSearchResultsSchema.safeParse({ ...results([]), source: "uniswap-v4-subgraph" })
      .success).toBe(false);
  });

  it("refuses results with no terms to have been ranked against", () => {
    expect(PoolSearchResultsSchema.safeParse(results([], [])).success).toBe(false);
  });
});
