import { describe, expect, it, vi } from "vitest";

import { fetchEthereumV3PoolDays, V3_POOL_DAYS_QUERY } from "./ethereumV3PoolDays";
import { poolDaysWindowStart, V4_POOL_DAYS_LIMIT } from "./ethereumV4PoolDays";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const NOW = new Date("2026-09-24T12:00:00.000Z");
const body = { data: { poolDayDatas: [], _meta: { hasIndexingErrors: false } } };

const answering = () => vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 }));

const run = (overrides: Partial<Parameters<typeof fetchEthereumV3PoolDays>[0]> = {}) =>
  fetchEthereumV3PoolDays({
    apiKey: API_KEY,
    subgraphId: "TestV3SubgraphId",
    fetchImpl: answering(),
    now: () => NOW,
    ...overrides,
  });

describe("fetchEthereumV3PoolDays", () => {
  it("asks the v3 subgraph for the week's busiest pool-days, each with what it traded and charged", async () => {
    const fetchImpl = answering();
    await run({ fetchImpl });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    const sent = JSON.parse(String(init.body)) as { query: string; variables: Record<string, unknown> };

    expect(String(url)).toContain("/subgraphs/id/TestV3SubgraphId");
    expect(sent.query).toBe(V3_POOL_DAYS_QUERY);
    expect(sent.query).toContain("where: { date_gte: $from }");
    expect(sent.query).toContain("volumeUSD");
    expect(sent.query).toContain("feesUSD");
    expect(sent.variables).toEqual({ from: poolDaysWindowStart(NOW), limit: V4_POOL_DAYS_LIMIT });
  });

  it("keeps the key out of the address and in the header", async () => {
    const fetchImpl = answering();
    await run({ fetchImpl });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;

    expect(String(url)).not.toContain(API_KEY);
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${API_KEY}`);
  });

  it("returns the answer untouched, stamped with when it was read", async () => {
    expect(await run()).toEqual({ status: "success", data: { payload: body, fetchedAt: NOW.toISOString() } });
  });

  it("asks nothing when it has no key or no subgraph", async () => {
    for (const missing of [{ apiKey: undefined }, { apiKey: " " }, { subgraphId: undefined }, { subgraphId: "" }]) {
      const fetchImpl = answering();
      expect(await run({ fetchImpl, ...missing })).toEqual({
        status: "unavailable",
        reason: "configuration-error",
        notice: "market-data-not-configured",
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("says why when the source does not answer", async () => {
    const result = await run({ fetchImpl: vi.fn<FetchLike>(async () => new Response("no", { status: 503 })) });

    expect(result.status).toBe("unavailable");
  });
});
