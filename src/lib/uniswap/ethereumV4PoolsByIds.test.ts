import { describe, expect, it, vi } from "vitest";

import { fetchEthereumV4PoolsByIds, V4_POOLS_BY_IDS_QUERY } from "./ethereumV4PoolsByIds";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const SUBGRAPH_ID = "TestV4SubgraphId";
const POOL = "0xa86fb6fbddb6d2e85e39b9894ff33c799cddbc4051ede12bc8399b8c3d51670a";
const NATIVE = "0x0000000000000000000000000000000000000000";
const HEI = "0xf8f173e20e15f3b6cb686fb64724d370689de083";

/* The ETH/HEI pool as the indexer described it on 2026-09-18. */
const rawPool = (overrides: Record<string, unknown> = {}) => ({
  id: POOL,
  tick: "98526",
  token0: { id: NATIVE, symbol: "ETH", decimals: "18" },
  token1: { id: HEI, symbol: "HEI", decimals: "18" },
  ...overrides,
});

const body = (pools: readonly unknown[], hasIndexingErrors = false) => ({
  data: { pools, _meta: { hasIndexingErrors } },
});

const jsonResponse = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200 });

const run = (
  overrides: Partial<Parameters<typeof fetchEthereumV4PoolsByIds>[0]> = {},
  payload: unknown = body([rawPool()]),
) =>
  fetchEthereumV4PoolsByIds({
    poolIds: [POOL],
    apiKey: API_KEY,
    subgraphId: SUBGRAPH_ID,
    fetchImpl: vi.fn<FetchLike>(async () => jsonResponse(payload)),
    timeoutMs: 1_000,
    ...overrides,
  });

const succeed = async (...args: Parameters<typeof run>) => {
  const result = await run(...args);
  if (result.status === "unavailable") throw new Error(`expected pools: ${result.notice}`);
  return result.data;
};

describe("fetchEthereumV4PoolsByIds", () => {
  it("names a pool's pair and says where its price is", async () => {
    expect(await succeed()).toEqual([
      {
        poolId: POOL,
        token0: { chainId: 1, address: NATIVE, symbol: "ETH", decimals: 18 },
        token1: { chainId: 1, address: HEI, symbol: "HEI", decimals: 18 },
        tick: 98_526,
      },
    ]);
  });

  /*
   * Measured on 2026-09-15: the indexer's `feeTier` is the total fee of the
   * pool's latest swap, not the key's fee. The key is already here from the
   * chain, so asking for the field at all could only introduce a wrong number.
   */
  it("never asks for the fee, the spacing or the hook", async () => {
    expect(V4_POOLS_BY_IDS_QUERY).not.toContain("feeTier");
    expect(V4_POOLS_BY_IDS_QUERY).not.toContain("tickSpacing");
    expect(V4_POOLS_BY_IDS_QUERY).not.toContain("hooks");
  });

  it("asks about each id once, lower-cased", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(body([rawPool()])));
    await run({ poolIds: [POOL.toUpperCase().replace("0X", "0x"), POOL], fetchImpl });

    const [, init] = fetchImpl.mock.calls[0] ?? [];

    expect(JSON.parse(String(init?.body)).variables).toEqual({ ids: [POOL], limit: 1 });
  });

  it("asks nothing at all when there are no pools to ask about", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(body([])));

    expect(await succeed({ poolIds: [], fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  /* A pool nobody has swapped in reports no tick; that is unread, not zero. */
  it("keeps an unread tick unread", async () => {
    expect((await succeed({}, body([rawPool({ tick: null })])))[0]?.tick).toBeNull();
  });

  /*
   * A pool that does not verify is left out rather than failing the read: one
   * named pool with another dropped is a true, shorter answer.
   */
  it.each([
    ["decimals that are not a number", { token0: { id: NATIVE, symbol: "ETH", decimals: "x" } }],
    ["an address that is not one", { token1: { id: "0xnope", symbol: "HEI", decimals: "18" } }],
  ])("drops a pool with %s", async (_label, overrides) => {
    expect(await succeed({}, body([rawPool(overrides), rawPool({ id: `0x${"1".repeat(64)}` })])))
      .toHaveLength(1);
  });

  it.each([
    ["no api key", { apiKey: "  " }],
    ["no subgraph", { subgraphId: undefined }],
  ])("refuses %s before anything goes out", async (_label, overrides) => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(body([])));
    const result = await run({ ...overrides, fetchImpl });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe("market-data-not-configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["an answer of the wrong shape", { data: { pools: [{ id: 7 }] } }, "market-data-malformed"],
    ["an answer with no data", { errors: [{ message: "no" }] }, "market-data-malformed"],
    [
      "an indexer that says it is behind",
      body([rawPool()], true),
      "market-data-indexing-errors",
    ],
  ])("refuses %s", async (_label, payload, notice) => {
    const result = await run({}, payload);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe(notice);
  });
});
