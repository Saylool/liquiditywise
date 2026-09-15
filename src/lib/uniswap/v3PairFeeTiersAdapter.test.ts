import { describe, expect, it, vi } from "vitest";

import { normalizeV3PairFeeTiers } from "./v3PairFeeTiersAdapter";

const FETCHED_AT = "2026-09-15T08:21:00.000Z";

const address = (hex: string) => `0x${hex.repeat(40)}`;

/* Ordered so that every fixture pool satisfies token0 < token1 on its own. */
const USDC = address("1");
const WETH = address("b");
const OTHER_HIGH = address("d");
const OTHER_LOW = `0x0${"2".repeat(39)}`;

const POOL_500 = address("5");

const rawToken = (id: string, symbol: string, decimals: string, name = symbol) => ({
  id,
  symbol,
  name,
  decimals,
});

/**
 * One raw pool of the pair. Token addresses are fixed so that token0 always
 * sorts before token1, which is what the domain schema requires and what the
 * source really does return.
 */
const rawPool = ({
  id,
  feeTier,
  tvl = "1000000",
  pair = [USDC, WETH],
}: {
  id: string;
  feeTier: string;
  tvl?: string;
  pair?: readonly [string, string];
}) => ({
  id,
  feeTier,
  totalValueLockedUSD: tvl,
  token0: rawToken(pair[0], "USDC", "6"),
  token1: rawToken(pair[1], "WETH", "18"),
});

const payload = (pools: readonly unknown[]) => ({
  data: { pools, _meta: { hasIndexingErrors: false } },
});

const normalize = (
  body: unknown,
  analysedPoolId = POOL_500,
  onDiagnostic?: (detail: string) => void,
) => normalizeV3PairFeeTiers({ payload: body, analysedPoolId, fetchedAt: FETCHED_AT, onDiagnostic });

const succeeded = (result: ReturnType<typeof normalize>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  return result.data;
};

describe("normalizeV3PairFeeTiers", () => {
  it("reads a pair's pools into the domain shape", () => {
    const data = succeeded(
      normalize(payload([rawPool({ id: POOL_500, feeTier: "500", tvl: "413951941.5" })])),
    );

    expect(data).toEqual({
      analysedPoolId: POOL_500,
      fetchedAt: FETCHED_AT,
      source: "uniswap-v3-subgraph",
      tiers: [
        {
          pool: {
            protocolVersion: "v3",
            chainId: 1,
            id: POOL_500,
            token0: { chainId: 1, address: USDC, symbol: "USDC", name: "USDC", decimals: 6 },
            token1: { chainId: 1, address: WETH, symbol: "WETH", name: "WETH", decimals: 18 },
            feePpm: 500,
          },
          tvlUsd: 413951941.5,
        },
      ],
    });
  });

  /*
   * The query orders by the source's liquidity figure so that a window cannot
   * drop a pool that matters. What gets published is this application's order.
   */
  it("republishes the source's order as ascending fee", () => {
    const data = succeeded(
      normalize(
        payload([
          rawPool({ id: POOL_500, feeTier: "500", tvl: "413951941" }),
          rawPool({ id: address("3"), feeTier: "3000", tvl: "304691772" }),
          rawPool({ id: address("a"), feeTier: "10000", tvl: "10435505" }),
          rawPool({ id: address("1"), feeTier: "100", tvl: "8701671" }),
        ]),
      ),
    );

    expect(data.tiers.map((entry) => entry.pool.feePpm)).toEqual([100, 500, 3_000, 10_000]);
  });

  it("drops a sibling it cannot verify and keeps the rest", () => {
    const onDiagnostic = vi.fn();
    const data = succeeded(
      normalize(
        payload([
          rawPool({ id: POOL_500, feeTier: "500" }),
          // A symbol carrying a newline is a token label this application refuses.
          {
            ...rawPool({ id: address("3"), feeTier: "3000" }),
            token1: rawToken(WETH, "WE\nTH", "18"),
          },
        ]),
        POOL_500,
        onDiagnostic,
      ),
    );

    expect(data.tiers.map((entry) => entry.pool.feePpm)).toEqual([500]);
    expect(onDiagnostic).toHaveBeenCalledWith("1 of 2 fee tiers unverifiable");
  });

  /*
   * The pool the reader is on is not special-cased in the loop; the domain
   * schema requires it, so losing it takes the panel down rather than showing
   * every tier except the reader's own.
   */
  it("refuses the whole read when the analysed pool is the one dropped", () => {
    const result = normalize(
      payload([
        { ...rawPool({ id: POOL_500, feeTier: "500" }), feeTier: "not-a-number" },
        rawPool({ id: address("3"), feeTier: "3000" }),
      ]),
    );

    expect(result.status).toBe("unavailable");
  });

  it.each([
    ["the second token differs", [USDC, OTHER_HIGH] as const],
    ["the first token differs", [OTHER_LOW, WETH] as const],
  ])("refuses a payload whose pools are not all one pair, when %s", (_label, pair) => {
    const result = normalize(
      payload([
        rawPool({ id: POOL_500, feeTier: "500" }),
        rawPool({ id: address("3"), feeTier: "3000", pair }),
      ]),
    );

    expect(result.status).toBe("unavailable");
  });

  it("refuses a payload that does not carry the analysed pool at all", () => {
    const result = normalize(payload([rawPool({ id: address("3"), feeTier: "3000" })]));

    expect(result.status).toBe("unavailable");
  });

  it.each([
    ["a body that is not the expected shape", { data: { pools: "none" } }],
    ["a response carrying errors beside data", { ...payload([]), errors: [{ message: "x" }] }],
    ["a response with no data", { data: null }],
    [
      // A publishable list, so the flag is the only thing that can refuse it.
      "a source reporting indexing errors",
      {
        data: {
          pools: [rawPool({ id: POOL_500, feeTier: "500" })],
          _meta: { hasIndexingErrors: true },
        },
      },
    ],
  ])("refuses %s", (_label, body) => {
    expect(normalize(body).status).toBe("unavailable");
  });

  it("says nothing when every pool verified", () => {
    const onDiagnostic = vi.fn();
    normalize(payload([rawPool({ id: POOL_500, feeTier: "500" })]), POOL_500, onDiagnostic);

    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});
