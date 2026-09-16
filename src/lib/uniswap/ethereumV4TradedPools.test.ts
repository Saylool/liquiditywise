import { describe, expect, it, vi } from "vitest";

import { TRADED_POOL_LIMIT } from "./ethereumV3TradedPools";
import {
  fetchEthereumV4TradedPools,
  tradedWindowStart,
  V4_TRADED_POOL_DAYS_LIMIT,
  V4_TRADED_POOLS_QUERY,
  V4_TRADED_WINDOW_DAYS,
} from "./ethereumV4TradedPools";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const NOW = new Date("2026-09-15T12:00:00.000Z");

const pool = {
  id: `0x${"e5".repeat(32)}`,
  createdAtBlockNumber: "21688329",
  tickSpacing: "10",
  hooks: `0x${"0".repeat(40)}`,
  token0: { id: `0x${"0".repeat(40)}`, symbol: "ETH", name: "Ether", decimals: "18", derivedETH: "1" },
  token1: { id: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
};

/** The busiest pool-days of the week: the same pool on two of its days. */
const body = {
  data: {
    poolDayDatas: [{ pool }, { pool }],
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
  it("returns the verified pools, each once, with the time they were read", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools).toHaveLength(1);
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

  /*
   * Not the v3 query. The source refuses every ordering of `pools`, and
   * answers the day table filtered by date in under a second — so that is
   * what is asked, for the week that ends today.
   */
  it("asks for the week's busiest pool-days, never for pools ordered by volume", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 }));
    await run({ fetchImpl });
    const sent = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as { query: string; variables: unknown };

    expect(sent.query).toBe(V4_TRADED_POOLS_QUERY);
    expect(sent.query).toContain("poolDayDatas(");
    expect(sent.query).toContain("where: { date_gte: $from }");
    expect(sent.query).not.toContain("txCount");
    expect(sent.variables).toEqual({ from: tradedWindowStart(NOW), limit: V4_TRADED_POOL_DAYS_LIMIT });
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

describe("tradedWindowStart", () => {
  const midnight = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / 1000;

  /* A day's `date` is its first second, so the window opens at midnight UTC six days back. */
  it("opens at midnight UTC, six days before the day now falls in", () => {
    expect(tradedWindowStart(new Date("2026-09-15T12:00:00.000Z"))).toBe(midnight(2026, 9, 9));
  });

  it("moves with the day and not with the hour", () => {
    expect(tradedWindowStart(new Date("2026-09-15T23:59:59.999Z"))).toBe(midnight(2026, 9, 9));
    expect(tradedWindowStart(new Date("2026-09-16T00:00:00.000Z"))).toBe(midnight(2026, 9, 10));
  });

  it("covers the declared number of calendar days, today included", () => {
    const today = midnight(2026, 9, 15);

    expect((today - tradedWindowStart(new Date("2026-09-15T12:00:00.000Z"))) / 86_400 + 1).toBe(V4_TRADED_WINDOW_DAYS);
  });

  it("is the v3 net's width once the days are folded into pools", () => {
    expect(V4_TRADED_POOL_DAYS_LIMIT).toBeGreaterThan(TRADED_POOL_LIMIT);
  });
});
