import { describe, expect, it, vi } from "vitest";

import {
  fetchEthereumV4PoolDays,
  poolDaysWindowStart,
  V4_POOL_DAYS_LIMIT,
  V4_POOL_DAYS_QUERY,
  V4_POOL_DAYS_WINDOW,
} from "./ethereumV4PoolDays";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const NOW = new Date("2026-09-15T12:00:00.000Z");

const body = {
  data: {
    poolDayDatas: [{ pool: { id: `0x${"e5".repeat(32)}` } }],
    poolManagers: [{ id: "0x000000000004444c5dc75cb358380d2e3de08a90" }],
    _meta: { hasIndexingErrors: false },
  },
};

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4PoolDays>[0]> = {}) =>
  fetchEthereumV4PoolDays({
    apiKey: API_KEY,
    subgraphId: "TestV4SubgraphId",
    fetchImpl: vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 })),
    now: () => NOW,
    ...overrides,
  });

describe("fetchEthereumV4PoolDays", () => {
  /*
   * Not the v3 query. The source refuses every ordering of `pools`, and
   * answers the day table filtered by date in under a second — so that is
   * what is asked, for the week that ends today.
   */
  it("asks for the week's busiest pool-days, never for pools ordered by volume", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 }));
    await run({ fetchImpl });
    const sent = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as { query: string; variables: unknown };

    expect(sent.query).toBe(V4_POOL_DAYS_QUERY);
    expect(sent.query).toContain("poolDayDatas(");
    expect(sent.query).toContain("where: { date_gte: $from }");
    expect(sent.query).not.toContain("txCount");
    expect(sent.variables).toEqual({ from: poolDaysWindowStart(NOW), limit: V4_POOL_DAYS_LIMIT });
  });

  /* The payload is handed on untrusted, with the moment it was read: it is shared, and may be minutes old at the point of use. */
  it("returns the body it was given, with the time of the read", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.payload).toEqual(body);
    expect(result.data.fetchedAt).toBe(NOW.toISOString());
  });

  it.each([
    ["no key", { apiKey: undefined }],
    ["a blank key", { apiKey: "   " }],
    ["no subgraph", { subgraphId: undefined }],
  ])("reports %s as configuration, without calling out", async (_label, overrides) => {
    const fetchImpl = vi.fn<FetchLike>();
    const result = await run({ fetchImpl, ...overrides });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-not-configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("passes a refused read on with its own reason", async () => {
    const result = await run({ fetchImpl: vi.fn(async () => new Response("nope", { status: 429 })) });

    expect(result.status === "unavailable" && result.reason).toBe("rate-limited");
  });

  it("keeps the key out of a failure", async () => {
    const result = await run({ fetchImpl: vi.fn(async () => new Response("{}", { status: 401 })) });

    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });
});

describe("poolDaysWindowStart", () => {
  const midnight = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / 1000;

  /* A day's `date` is its first second, so the window opens at midnight UTC six days back. */
  it("opens at midnight UTC, six days before the day now falls in", () => {
    expect(poolDaysWindowStart(new Date("2026-09-15T12:00:00.000Z"))).toBe(midnight(2026, 9, 9));
  });

  it("moves with the day and not with the hour", () => {
    expect(poolDaysWindowStart(new Date("2026-09-15T23:59:59.999Z"))).toBe(midnight(2026, 9, 9));
    expect(poolDaysWindowStart(new Date("2026-09-16T00:00:00.000Z"))).toBe(midnight(2026, 9, 10));
  });

  it("covers the declared number of calendar days, today included", () => {
    const today = midnight(2026, 9, 15);

    expect((today - poolDaysWindowStart(new Date("2026-09-15T12:00:00.000Z"))) / 86_400 + 1).toBe(V4_POOL_DAYS_WINDOW);
  });
});
