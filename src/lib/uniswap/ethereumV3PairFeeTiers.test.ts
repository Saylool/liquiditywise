import { describe, expect, it, vi } from "vitest";

import { PAIR_FEE_TIER_FETCH_LIMIT } from "../../schemas";
import { fetchEthereumV3PairFeeTiers, V3_PAIR_FEE_TIERS_QUERY } from "./ethereumV3PairFeeTiers";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const SUBGRAPH_ID = "TestStableSubgraphId";
const NOW = new Date("2026-09-15T08:21:00.000Z");

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const POOL_500 = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const POOL_3000 = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";

const rawPool = (id: string, feeTier: string, tvl: string) => ({
  id,
  feeTier,
  totalValueLockedUSD: tvl,
  token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
  token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
});

const successBody = {
  data: {
    pools: [rawPool(POOL_500, "500", "413951941.5"), rawPool(POOL_3000, "3000", "304691772.1")],
    _meta: { hasIndexingErrors: false },
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const run = (overrides: Partial<Parameters<typeof fetchEthereumV3PairFeeTiers>[0]> = {}) =>
  fetchEthereumV3PairFeeTiers({
    poolAddress: POOL_500,
    token0Address: USDC,
    token1Address: WETH,
    apiKey: API_KEY,
    subgraphId: SUBGRAPH_ID,
    /* No endpoint: the tiers then arrive with no reserves, which is a state the
     * page renders rather than a failure. */
    rpcUrl: undefined,
    fetchImpl: vi.fn<FetchLike>(async () => jsonResponse(successBody)),
    now: () => NOW,
    ...overrides,
  });

const captureRequest = async (
  overrides: Partial<Parameters<typeof fetchEthereumV3PairFeeTiers>[0]> = {},
) => {
  const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(successBody));
  const result = await run({ fetchImpl, ...overrides });

  const call = fetchImpl.mock.calls[0];
  if (call === undefined) throw new Error("fetch was not called");
  const [url, init] = call;

  return {
    result,
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(String(init.body)) as { query: string; variables: Record<string, unknown> },
  };
};

describe("fetchEthereumV3PairFeeTiers", () => {
  it("returns every pool of the pair, ascending by fee", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.tiers.map((tier) => tier.pool.feePpm)).toEqual([500, 3_000]);
    expect(result.data.analysedPoolId).toBe(POOL_500);
    expect(result.data.fetchedAt).toBe(NOW.toISOString());
  });

  /*
   * Asked the other way round the source returns nothing, because a pool stores
   * its pair in address order. There is one selection for that reason, and the
   * caller is what guarantees the order.
   */
  it("asks once, with the pair in the order it was given", async () => {
    const { body } = await captureRequest();

    expect(body.query).toBe(V3_PAIR_FEE_TIERS_QUERY);
    expect(body.variables).toEqual({
      token0: USDC,
      token1: WETH,
      limit: PAIR_FEE_TIER_FETCH_LIMIT,
    });
  });

  it("sends the addresses as variables, never spliced into the query", async () => {
    const { body } = await captureRequest();

    expect(body.query).not.toContain(USDC);
    expect(body.query).toContain("$token0");
    expect(body.query).toContain("$token1");
  });

  it("asks for more pools than any pair has tiers", async () => {
    // The factory ships four, and each further one needs a governance vote.
    const { body } = await captureRequest();

    expect(body.variables.limit).toBeGreaterThan(4);
  });

  it("sends the key in the header and never in the URL", async () => {
    const { url, headers } = await captureRequest();

    expect(url).not.toContain(API_KEY);
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it("lowercases the addresses it was given, as every other reader does", async () => {
    const { body } = await captureRequest({ token0Address: USDC.toUpperCase().replace("0X", "0x") });

    expect(body.variables.token0).toBe(USDC);
  });

  it.each([
    ["a malformed pool address", { poolAddress: "0xnope" }],
    ["the zero address as the pool", { poolAddress: `0x${"0".repeat(40)}` }],
    ["a malformed token address", { token0Address: "usdc" }],
    ["the zero address as a token", { token1Address: `0x${"0".repeat(40)}` }],
  ])("refuses %s without calling the source", async (_label, overrides) => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(successBody));
    const result = await run({ fetchImpl, ...overrides });

    expect(result.status === "unavailable" && result.reason).toBe("invalid-input");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["no API key", { apiKey: undefined }],
    ["a blank API key", { apiKey: "   " }],
    ["no subgraph id", { subgraphId: undefined }],
    ["a blank subgraph id", { subgraphId: "" }],
  ])("reports %s as a configuration problem, without calling the source", async (_l, overrides) => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(successBody));
    const result = await run({ fetchImpl, ...overrides });

    expect(result.status === "unavailable" && result.reason).toBe("configuration-error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("checks the caller's input before the server's configuration", async () => {
    const result = await run({ poolAddress: "0xnope", apiKey: undefined });

    expect(result.status === "unavailable" && result.reason).toBe("invalid-input");
  });

  it.each([
    [401, "configuration-error"],
    [429, "rate-limited"],
    [500, "network-error"],
    [418, "invalid-response"],
  ])("maps HTTP %i onto its own failure", async (status, reason) => {
    const result = await run({
      fetchImpl: vi.fn<FetchLike>(async () => jsonResponse({}, status)),
    });

    expect(result.status === "unavailable" && result.reason).toBe(reason);
  });

  it("reports a request that never connected as a network failure", async () => {
    const result = await run({
      fetchImpl: vi.fn<FetchLike>(async () => {
        throw new TypeError("fetch failed");
      }),
    });

    expect(result.status === "unavailable" && result.reason).toBe("network-error");
  });

  it("passes the diagnostic through to the caller", async () => {
    const onDiagnostic = vi.fn();
    const withBadPool = {
      data: {
        pools: [
          rawPool(POOL_500, "500", "413951941.5"),
          rawPool(POOL_3000, "three thousand", "304691772.1"),
        ],
        _meta: { hasIndexingErrors: false },
      },
    };

    await run({
      fetchImpl: vi.fn<FetchLike>(async () => jsonResponse(withBadPool)),
      onDiagnostic,
    });

    expect(onDiagnostic).toHaveBeenCalledWith("1 of 2 fee tiers unverifiable");
  });
});

describe("fetchEthereumV3PairFeeTiers for a pair named from elsewhere", () => {
  it("accepts no analysed pool and forwards the null", async () => {
    const result = await run({ poolAddress: null });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.analysedPoolId).toBeNull();
  });
});
