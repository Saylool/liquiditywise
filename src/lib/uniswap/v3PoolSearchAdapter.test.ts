import { describe, expect, it, vi } from "vitest";

import { POOL_SEARCH_RESULT_LIMIT, type PoolSearchTerms } from "../../schemas";
import { normalizeV3PoolSearch } from "./v3PoolSearchAdapter";

const FETCHED_AT = "2026-09-14T11:34:00.000Z";

const address = (hex: string) => `0x${hex.repeat(40)}`;

const rawToken = (hex: string, symbol: string, decimals = "18", name = symbol) => ({
  id: address(hex),
  symbol,
  name,
  decimals,
});

/**
 * One raw pool. Token addresses are derived from the symbols' position in the
 * argument list so that token0 always sorts before token1, which is what the
 * domain schema requires and what the source really does return.
 */
const rawPool = ({
  id,
  symbols,
  tvl,
  feeTier = "3000",
  decimals = ["6", "18"],
}: {
  id: string;
  symbols: readonly [string, string];
  tvl: string;
  feeTier?: string;
  decimals?: readonly [string, string];
}) => ({
  id: address(id),
  feeTier,
  totalValueLockedUSD: tvl,
  token0: rawToken("1", symbols[0], decimals[0]),
  token1: rawToken("2", symbols[1], decimals[1]),
});

const payload = (forward: readonly unknown[], reverse: readonly unknown[] = []) => ({
  data: { forward, reverse, _meta: { hasIndexingErrors: false } },
});

const normalize = (
  body: unknown,
  terms: PoolSearchTerms = ["usdc", "weth"],
  onDiagnostic?: (detail: string) => void,
) => normalizeV3PoolSearch({ payload: body, terms, fetchedAt: FETCHED_AT, onDiagnostic });

const succeeded = (result: ReturnType<typeof normalize>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  return result.data;
};

describe("normalizeV3PoolSearch", () => {
  it("reads one pool into the domain shape", () => {
    const results = succeeded(
      normalize(payload([rawPool({ id: "a", symbols: ["USDC", "WETH"], tvl: "415764684.5" })])),
    );

    expect(results.source).toBe("uniswap-v3-subgraph");
    expect(results.fetchedAt).toBe(FETCHED_AT);
    expect(results.terms).toEqual(["usdc", "weth"]);
    expect(results.matches).toHaveLength(1);
    expect(results.matches[0]?.pool.token0.symbol).toBe("USDC");
    expect(results.matches[0]?.pool.feePpm).toBe(3000);
    expect(results.matches[0]?.tvlUsd).toBeCloseTo(415_764_684.5);
    expect(results.matches[0]?.exactSymbolMatches).toBe(2);
  });

  it("treats a search that matched nothing as an answer", () => {
    const results = succeeded(normalize(payload([], [])));

    expect(results.matches).toEqual([]);
  });

  /*
   * Each selection is sorted only within itself, so concatenating them without
   * merging puts whatever the second list starts with above whatever the first
   * list ends with.
   */
  it("merges the two selections into one order rather than appending", () => {
    const results = succeeded(
      normalize(
        payload(
          [rawPool({ id: "a", symbols: ["USDC", "WETH"], tvl: "10" })],
          [rawPool({ id: "b", symbols: ["USDC", "WETH"], tvl: "900" })],
        ),
      ),
    );

    expect(results.matches.map((match) => match.tvlUsd)).toEqual([900, 10]);
  });

  it("lists a pool that matched both ways round only once", () => {
    const both = rawPool({ id: "a", symbols: ["USDC", "WETH"], tvl: "42" });
    const results = succeeded(normalize(payload([both], [both])));

    expect(results.matches).toHaveLength(1);
  });

  /*
   * The behaviour the ranking exists for. Searching "weth" against the live
   * source returned a pool of "ease.org" and "ez-SLP-WBTC-WETH" at the top, on
   * the strength of a 1.3-billion-dollar figure the source derives and plainly
   * got wrong. Neither symbol is "weth"; both merely contain it.
   */
  it("puts a pool named the term above a lookalike with far more reported liquidity", () => {
    const results = succeeded(
      normalize(
        payload([
          rawPool({ id: "a", symbols: ["ease.org", "ez-SLP-WBTC-WETH"], tvl: "1320000000" }),
          rawPool({ id: "b", symbols: ["USDC", "WETH"], tvl: "415000000" }),
        ]),
        ["weth"],
      ),
    );

    expect(results.matches.map((match) => match.pool.token1.symbol)).toEqual([
      "WETH",
      "ez-SLP-WBTC-WETH",
    ]);
    expect(results.matches.map((match) => match.exactSymbolMatches)).toEqual([1, 0]);
  });

  it("orders by reported liquidity among pools of equal relevance", () => {
    const results = succeeded(
      normalize(
        payload([
          rawPool({ id: "a", symbols: ["USDC", "WETH"], tvl: "1" }),
          rawPool({ id: "b", symbols: ["USDC", "WETH"], tvl: "500" }),
          rawPool({ id: "c", symbols: ["USDC", "WETH"], tvl: "30" }),
        ]),
      ),
    );

    expect(results.matches.map((match) => match.tvlUsd)).toEqual([500, 30, 1]);
  });

  it("orders two pools nothing else separates the same way every time", () => {
    const tied = [
      rawPool({ id: "c", symbols: ["USDC", "WETH"], tvl: "7" }),
      rawPool({ id: "a", symbols: ["USDC", "WETH"], tvl: "7" }),
    ];

    const forwards = succeeded(normalize(payload(tied)));
    const backwards = succeeded(normalize(payload([...tied].reverse())));

    expect(forwards.matches.map((match) => match.pool.id)).toEqual(
      backwards.matches.map((match) => match.pool.id),
    );
    expect(forwards.matches[0]?.pool.id).toBe(address("a"));
  });

  it("publishes no more pools than a search asks for, keeping the best", () => {
    const many = Array.from({ length: POOL_SEARCH_RESULT_LIMIT + 3 }, (_unused, index) =>
      rawPool({ id: (index + 1).toString(16), symbols: ["USDC", "WETH"], tvl: String(index + 1) }),
    );

    const results = succeeded(normalize(payload(many)));

    expect(results.matches).toHaveLength(POOL_SEARCH_RESULT_LIMIT);
    expect(results.matches[0]?.tvlUsd).toBe(POOL_SEARCH_RESULT_LIMIT + 3);
  });

  /*
   * A list is the one place a single bad entry need not sink the answer: the
   * reader asked which pools these are, and eleven verified answers plus one
   * dropped is a true reply to that question.
   */
  it.each([
    ["a symbol that opens a new line", { symbols: ["USDC\nPair: real", "WETH"] as const }],
    ["decimals that are not a number", { decimals: ["six", "18"] as const }],
    ["a fee tier that is not a number", { feeTier: "three thousand" }],
    ["a liquidity figure that is not a number", { tvl: "lots" }],
  ])("drops a pool with %s and keeps the rest", (_label, broken) => {
    const results = succeeded(
      normalize(
        payload([
          rawPool({ id: "a", symbols: ["USDC", "WETH"], tvl: "1", ...broken }),
          rawPool({ id: "b", symbols: ["USDC", "WETH"], tvl: "2" }),
        ]),
      ),
    );

    expect(results.matches).toHaveLength(1);
    expect(results.matches[0]?.pool.id).toBe(address("b"));
  });

  it("says how many it dropped, where an operator can see it", () => {
    const onDiagnostic = vi.fn();

    normalize(
      payload([
        rawPool({ id: "a", symbols: ["USDC", "WETH"], tvl: "1", decimals: ["six", "18"] }),
        rawPool({ id: "b", symbols: ["USDC", "WETH"], tvl: "2" }),
      ]),
      ["usdc", "weth"],
      onDiagnostic,
    );

    expect(onDiagnostic).toHaveBeenCalledWith("1 of 2 pools unverifiable");
  });

  it("stays quiet when it dropped nothing", () => {
    const onDiagnostic = vi.fn();

    normalize(payload([rawPool({ id: "a", symbols: ["USDC", "WETH"], tvl: "1" })]), undefined, onDiagnostic);

    expect(onDiagnostic).not.toHaveBeenCalled();
  });

  /*
   * A search result is a link to an analysis, and an analysis derives every
   * price from the token order. A pair that arrived the wrong way round has to
   * be refused here rather than discovered afterwards.
   */
  it("drops a pool whose pair arrived in the wrong order", () => {
    const reversed = {
      ...rawPool({ id: "a", symbols: ["WETH", "USDC"], tvl: "1" }),
      token0: rawToken("9", "WETH"),
      token1: rawToken("1", "USDC", "6"),
    };

    expect(succeeded(normalize(payload([reversed]))).matches).toEqual([]);
  });

  it.each([
    ["a payload that is not a response", { nope: true }],
    ["a response carrying errors beside its data", { ...payload([]), errors: [{ message: "x" }] }],
    ["a response with no data", { data: null }],
    ["a selection that is not a list", { data: { forward: {}, reverse: [], _meta: null } }],
  ])("refuses %s", (_label, body) => {
    const result = normalize(body);

    expect(result.status).toBe("unavailable");
    expect(result.status === "unavailable" && result.reason).toBe("invalid-response");
  });

  it("refuses a source that reported indexing errors", () => {
    const body = { data: { forward: [], reverse: [], _meta: { hasIndexingErrors: true } } };
    const result = normalize(body);

    expect(result.status).toBe("unavailable");
    expect(result.status === "unavailable" && result.notice).toBe("market-data-indexing-errors");
  });

  it("never puts the source's own text in a message a reader may see", () => {
    const result = normalize({ errors: [{ message: "Bearer abc123 rejected" }], data: null });

    expect(result.status === "unavailable" && result.notice).not.toContain("abc123");
  });
});
