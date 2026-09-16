import { describe, expect, it, vi } from "vitest";

import { TRADED_POOL_LIMIT, TRADED_POOL_MIN_TX_COUNT } from "./ethereumV3TradedPools";
import { fetchEthereumV4TradedPools, V4_TRADED_POOLS_QUERY } from "./ethereumV4TradedPools";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const NOW = new Date("2026-09-15T12:00:00.000Z");

const body = {
  data: {
    pools: [
      {
        id: `0x${"e5".repeat(32)}`,
        createdAtBlockNumber: "21688329",
        tickSpacing: "10",
        hooks: `0x${"0".repeat(40)}`,
        token0: { id: `0x${"0".repeat(40)}`, symbol: "ETH", name: "Ether", decimals: "18", derivedETH: "1" },
        token1: { id: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
      },
    ],
    poolManagers: [{ id: "0x000000000004444c5dc75cb358380d2e3de08a90" }],
    _meta: { hasIndexingErrors: false },
  },
};

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4TradedPools>[0]> = {}) =>
  fetchEthereumV4TradedPools({
    apiKey: API_KEY,
    subgraphId: "TestV4SubgraphId",
    fetchImpl: vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 })),
    now: () => NOW,
    ...overrides,
  });

describe("fetchEthereumV4TradedPools", () => {
  it("returns the verified pools with the time they were read", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools[0]?.token0.symbol).toBe("ETH");
    expect(result.data.fetchedAt).toBe(NOW.toISOString());
  });

  /* The chain is not asked here: every fee is unread, and the manager travels with the list for whoever asks later. */
  it("publishes every fee unread, with the manager and the creation blocks for a later read", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 }));
    const result = await run({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools[0]?.fee).toEqual({ kind: "unread" });
    expect(result.data.poolManager).toBe("0x000000000004444c5dc75cb358380d2e3de08a90");
    expect(result.data.createdAtBlockNumbers).toEqual({ [`0x${"e5".repeat(32)}`]: "21688329" });
  });

  /* The same net width as the v3 list, by construction rather than by copying the numbers. */
  it("asks with the v3 thresholds", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 }));
    await run({ fetchImpl });
    const sent = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as { query: string; variables: unknown };

    expect(sent.query).toBe(V4_TRADED_POOLS_QUERY);
    expect(sent.variables).toEqual({ minTxCount: TRADED_POOL_MIN_TX_COUNT, limit: TRADED_POOL_LIMIT });
  });

  it("reports a missing subgraph as configuration, without calling out", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const result = await run({ fetchImpl, subgraphId: undefined });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-not-configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps the key out of a failure", async () => {
    const result = await run({ fetchImpl: vi.fn(async () => new Response("{}", { status: 401 })) });

    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });
});
