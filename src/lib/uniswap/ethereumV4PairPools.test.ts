import { describe, expect, it, vi } from "vitest";

import { V4_PAIR_POOL_FETCH_LIMIT } from "../../schemas";
import { fetchEthereumV4PairPools, V4_PAIR_POOLS_QUERY } from "./ethereumV4PairPools";
import type { FetchLike } from "./v3SubgraphTransport";
import { EXTSLOAD_SELECTOR } from "./v4PoolStateSlots";

const API_KEY = "test-graph-key-must-never-leak";
const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const POOL_ID = `0x${"e5".repeat(32)}`;
const NOW = new Date("2026-09-15T12:00:00.000Z");

const subgraphBody = {
  data: {
    pools: [
      {
        id: POOL_ID,
        createdAtBlockNumber: "21688329",
        tickSpacing: "10",
        hooks: `0x${"0".repeat(40)}`,
        token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
        token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
      },
    ],
    poolManagers: [{ id: POOL_MANAGER }],
    _meta: { hasIndexingErrors: false },
  },
};

const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

/** The chain: no log for this fixture id, which is not a real hash, and a state for it. */
const bothEndpoints = (): FetchLike =>
  vi.fn(async (url, init) => {
    if (url === RPC_URL) {
      const calls = JSON.parse(String(init.body)) as { id: number; method: string }[];
      return new Response(
        JSON.stringify(
          calls.map((call, index) => ({
            jsonrpc: "2.0",
            id: call.id,
            result:
              call.method === "eth_getLogs"
                ? []
                : word(index % 2 === 0 ? (250n << 208n) | (198_320n << 160n) | 1584563250285286751870879006n : 5n),
          })),
        ),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(subgraphBody), { status: 200 });
  });

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4PairPools>[0]> = {}) =>
  fetchEthereumV4PairPools({
    analysedPoolId: POOL_ID,
    token0Address: USDC,
    token1Address: WETH,
    apiKey: API_KEY,
    subgraphId: "TestV4SubgraphId",
    rpcUrl: RPC_URL,
    fetchImpl: bothEndpoints(),
    now: () => NOW,
    ...overrides,
  });

describe("fetchEthereumV4PairPools", () => {
  it("returns the pair's pools with their state from the chain", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools[0]?.state?.liquidity).toBe("5");
    expect(result.data.analysedPoolId).toBe(POOL_ID);
  });

  it("asks for the pair by both addresses, as variables, with the wide window", async () => {
    const fetchImpl = bothEndpoints();
    await run({ fetchImpl });
    const body = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as { query: string; variables: unknown };

    expect(body.query).toBe(V4_PAIR_POOLS_QUERY);
    expect(body.variables).toEqual({ token0: USDC, token1: WETH, limit: V4_PAIR_POOL_FETCH_LIMIT });
    expect(body.query).not.toContain(USDC);
  });

  it("reads the manager the source named, for its logs and its storage", async () => {
    const fetchImpl = bothEndpoints();
    await run({ fetchImpl });
    const requests = vi
      .mocked(fetchImpl)
      .mock.calls.slice(1)
      .flatMap(([, init]) => JSON.parse(String(init.body)) as { method: string; params: [{ to?: string; data?: string; address?: string }] }[]);
    const calls = requests.filter((request) => request.method === "eth_call");

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call.params[0].to === POOL_MANAGER)).toBe(true);
    expect(calls.every((call) => call.params[0].data?.startsWith(EXTSLOAD_SELECTOR))).toBe(true);
  });

  /*
   * The fixture pool has no hook, so its stored fee is its key's and no log is
   * asked for at all: the costly read is spent on hooked pools alone.
   */
  it("settles a hookless pool's fee from its state, without reading its log", async () => {
    const fetchImpl = bothEndpoints();
    const result = await run({ fetchImpl });
    const methods = vi
      .mocked(fetchImpl)
      .mock.calls.slice(1)
      .flatMap(([, init]) => (JSON.parse(String(init.body)) as { method: string }[]).map((r) => r.method));

    expect(result.status === "success" && result.data.pools[0]?.pool.fee).toEqual({ kind: "static", feePpm: 250 });
    expect(methods).not.toContain("eth_getLogs");
    expect(methods).toContain("eth_call");
  });

  it("accepts a pair named from a v3 page, with no analysed pool", async () => {
    const result = await run({ analysedPoolId: null });

    expect(result.status === "success" && result.data.analysedPoolId).toBeNull();
  });

  /* Native ether is a currency here: the zero address is a valid side of a v4 pair. */
  it("accepts the zero address as a currency", async () => {
    const fetchImpl = bothEndpoints();
    const result = await run({ fetchImpl, analysedPoolId: null, token0Address: `0x${"0".repeat(40)}`, token1Address: USDC });

    expect(result.status).not.toBe("unavailable");
  });

  it.each([
    ["a pair the wrong way round", { token0Address: WETH, token1Address: USDC }],
    ["a malformed analysed id", { analysedPoolId: "0xnope" }],
    ["a malformed address", { token1Address: "0xnope" }],
  ])("refuses %s without calling anything", async (_label, overrides) => {
    const fetchImpl = bothEndpoints();
    const result = await run({ fetchImpl, ...overrides });

    expect(result.status === "unavailable" && result.notice).toBe("invalid-pool-address");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a missing v4 subgraph as configuration", async () => {
    const result = await run({ subgraphId: undefined });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-not-configured");
  });
});
