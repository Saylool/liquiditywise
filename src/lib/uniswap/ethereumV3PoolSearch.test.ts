import { describe, expect, it, vi } from "vitest";

import {
  fetchEthereumV3PoolSearch,
  POOL_SEARCH_FETCH_LIMIT,
  V3_POOL_SEARCH_PAIR_QUERY,
  V3_POOL_SEARCH_SINGLE_QUERY,
} from "./ethereumV3PoolSearch";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const SUBGRAPH_ID = "TestStableSubgraphId";
const NOW = new Date("2026-09-14T11:34:00.000Z");

const successBody = {
  data: {
    forward: [],
    reverse: [
      {
        id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
        feeTier: "500",
        totalValueLockedUSD: "415764684.5",
        token0: {
          id: "0x1111111111111111111111111111111111111111",
          symbol: "USDC",
          name: "USD Coin",
          decimals: "6",
          derivedETH: "0.0004",
        },
        token1: {
          id: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: "18",
          derivedETH: "1",
        },
      },
    ],
    _meta: { hasIndexingErrors: false },
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const run = (overrides: Partial<Parameters<typeof fetchEthereumV3PoolSearch>[0]> = {}) =>
  fetchEthereumV3PoolSearch({
    terms: ["usdc", "weth"],
    apiKey: API_KEY,
    subgraphId: SUBGRAPH_ID,
    /* No endpoint: the results then arrive with no reserves, which the page
     * renders as unread rather than as empty pools. */
    rpcUrl: undefined,
    fetchImpl: vi.fn<FetchLike>(async () => jsonResponse(successBody)),
    now: () => NOW,
    ...overrides,
  });

const captureRequest = async (
  overrides: Partial<Parameters<typeof fetchEthereumV3PoolSearch>[0]> = {},
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

describe("fetchEthereumV3PoolSearch", () => {
  it("returns the pools the source matched", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0]?.pool.token0.symbol).toBe("USDC");
    expect(result.data.fetchedAt).toBe(NOW.toISOString());
  });

  it("asks both ways round for a pair, in one request", async () => {
    const { body } = await captureRequest({ terms: ["usdc", "weth"] });

    expect(body.query).toBe(V3_POOL_SEARCH_PAIR_QUERY);
    expect(body.variables).toEqual({
      first: "usdc",
      second: "weth",
      limit: POOL_SEARCH_FETCH_LIMIT,
    });
  });

  it("pins one side per selection for a single term", async () => {
    const { body } = await captureRequest({ terms: ["weth"] });

    expect(body.query).toBe(V3_POOL_SEARCH_SINGLE_QUERY);
    expect(body.variables).toEqual({ term: "weth", limit: POOL_SEARCH_FETCH_LIMIT });
  });

  /*
   * A term is whatever a visitor typed. It travels as a variable, so a query is
   * well-formed whatever it contains — which is the property worth pinning,
   * since the alternative is a query built by concatenation.
   */
  it("sends the terms as variables, never spliced into the query", async () => {
    const { body } = await captureRequest({ terms: ["usdc", "weth"] });

    expect(body.query).not.toContain("usdc");
    expect(body.query).toContain("$first");
    expect(body.query).toContain("$second");
  });

  it("asks each selection for more pools than it will publish", async () => {
    // The source orders by its own dollar figure and this application does not,
    // so a pool named exactly what was searched for has to be inside the window
    // before it can be promoted above one that merely contains the word.
    const { body } = await captureRequest();

    expect(body.variables.limit).toBeGreaterThan(1);
  });

  it("sends the key in the header and never in the URL", async () => {
    const { url, headers } = await captureRequest();

    expect(url).not.toContain(API_KEY);
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it.each([
    ["no terms", []],
    ["three terms", ["usdc", "weth", "dai"]],
    ["a term that is too short", ["a"]],
    ["a term made of something else", ["$weth"]],
  ])("refuses %s without calling the source", async (_label, terms) => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(successBody));
    const result = await run({ terms, fetchImpl });

    expect(result.status).toBe("unavailable");
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
    // Input first: a visitor's typo is their business to fix, and telling them
    // the server is misconfigured would send them after the wrong problem.
    const result = await run({ terms: ["a"], apiKey: undefined });

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
        forward: [{ ...successBody.data.reverse[0], feeTier: "three thousand" }],
        reverse: [],
        _meta: { hasIndexingErrors: false },
      },
    };

    await run({
      fetchImpl: vi.fn<FetchLike>(async () => jsonResponse(withBadPool)),
      onDiagnostic,
    });

    expect(onDiagnostic).toHaveBeenCalledWith("1 of 1 pools unverifiable");
  });
});
