import { describe, expect, it, vi } from "vitest";

import {
  fetchEthereumV4PoolSearch,
  V4_POOL_SEARCH_FETCH_LIMIT,
  V4_POOL_SEARCH_PAIR_QUERY,
  V4_POOL_SEARCH_SINGLE_QUERY,
} from "./ethereumV4PoolSearch";
import type { FetchLike } from "./v3SubgraphTransport";
import { DYNAMIC_FEE_FLAG, INITIALIZE_TOPIC } from "./v4PoolKey";
import { EXTSLOAD_SELECTOR } from "./v4PoolStateSlots";

const API_KEY = "test-graph-key-must-never-leak";
const SUBGRAPH_ID = "TestStableV4SubgraphId";
const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const POOL_ID = "0xe500210c7ea6bfd9f69dce044b09ef384ec2b34832f132baec3b418208e3a657";
const NOW = new Date("2026-09-15T14:00:00.000Z");

const subgraphBody = {
  data: {
    forward: [
      {
        id: POOL_ID,
        createdAtBlockNumber: "21688329",
        tickSpacing: "10",
        hooks: "0x0000000aa232009084bd71a5797d089aa4edfad4",
        token0: {
          id: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          symbol: "USDC",
          name: "USD Coin",
          decimals: "6",
          derivedETH: "0.0004",
        },
        token1: {
          id: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: "18",
          derivedETH: "1",
        },
      },
    ],
    reverse: [],
    poolManagers: [{ id: POOL_MANAGER }],
    _meta: { hasIndexingErrors: false },
  },
};

const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
const addressWord = (address: string) => `0x${address.slice(2).padStart(64, "0")}`;
const SQRT_PRICE = 1584563250285286751870879006n;

/*
 * The fixture pool is mainnet's busiest hooked pool, so its real key — which
 * hashes to its id — can be put in the log the mocked chain answers with: a
 * dynamic fee, spacing 10, the hook above, USDC and WETH.
 */
const initializeLog = {
  address: POOL_MANAGER,
  topics: [
    INITIALIZE_TOPIC,
    POOL_ID,
    addressWord("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
    addressWord("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
  ],
  data: `0x${[BigInt(DYNAMIC_FEE_FLAG), 10n, BigInt("0x0000000aa232009084bd71a5797d089aa4edfad4"), SQRT_PRICE, 198_320n]
    .map((value) => value.toString(16).padStart(64, "0"))
    .join("")}`,
};

/**
 * One fetch that plays both parts: the gateway for the GraphQL request, and the
 * PoolManager for the batched `eth_getLogs` and `eth_call`s that follow it.
 */
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
                ? [initializeLog]
                : // First word of each pair is slot0, second is liquidity.
                  word(index % 2 === 0 ? ((198_320n) << 160n) | SQRT_PRICE : 642_953_328_768_594_464n),
          })),
        ),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(subgraphBody), { status: 200 });
  });

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4PoolSearch>[0]> = {}) =>
  fetchEthereumV4PoolSearch({
    terms: ["usdc", "weth"],
    apiKey: API_KEY,
    subgraphId: SUBGRAPH_ID,
    rpcUrl: RPC_URL,
    fetchImpl: bothEndpoints(),
    now: () => NOW,
    ...overrides,
  });

const requestsMade = (fetchImpl: FetchLike) =>
  vi.mocked(fetchImpl).mock.calls.map(([url, init]) => ({
    url,
    body: JSON.parse(String(init.body)) as unknown,
  }));

describe("fetchEthereumV4PoolSearch", () => {
  it("returns the pools the source matched, with their state from the chain", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0]?.pool.hookAddress).toBe("0x0000000aa232009084bd71a5797d089aa4edfad4");
    expect(result.data.matches[0]?.state).toEqual({
      liquidity: "642953328768594464",
      sqrtPriceX96: SQRT_PRICE.toString(),
    });
    expect(result.data.fetchedAt).toBe(NOW.toISOString());
  });

  /* The fee is the key's, from the log the chain answered with — dynamic, here. */
  it("takes each pool's fee from its Initialize log", async () => {
    const result = await run();

    expect(result.status === "success" && result.data.matches[0]?.pool.fee).toEqual({
      kind: "dynamic",
      currentFeePpm: null,
    });
    expect(result.status === "success" && result.data.matches[0]?.pool.protocolFee).toEqual({
      zeroForOnePpm: 0,
      oneForZeroPpm: 0,
    });
  });

  it("does not ask the source for its fee figure at all", async () => {
    const fetchImpl = bothEndpoints();
    await run({ fetchImpl });
    const [graph] = requestsMade(fetchImpl);

    expect((graph?.body as { query: string }).query).not.toContain("feeTier");
    expect((graph?.body as { query: string }).query).toContain("createdAtBlockNumber");
  });

  it("asks both ways round for a pair, in one request, with the terms as variables", async () => {
    const fetchImpl = bothEndpoints();
    await run({ fetchImpl });
    const [graph] = requestsMade(fetchImpl);
    const body = graph?.body as { query: string; variables: Record<string, unknown> };

    expect(body.query).toBe(V4_POOL_SEARCH_PAIR_QUERY);
    expect(body.variables).toEqual({ first: "usdc", second: "weth", limit: V4_POOL_SEARCH_FETCH_LIMIT });
    expect(body.query).not.toContain("usdc");
  });

  it("pins one side per selection for a single term", async () => {
    const fetchImpl = bothEndpoints();
    await run({ fetchImpl, terms: ["weth"] });
    const body = requestsMade(fetchImpl)[0]?.body as { query: string; variables: unknown };

    expect(body.query).toBe(V4_POOL_SEARCH_SINGLE_QUERY);
    expect(body.variables).toEqual({ term: "weth", limit: V4_POOL_SEARCH_FETCH_LIMIT });
  });

  /* The address the chain reads go to comes from the answer, not from here. */
  it("asks the source which PoolManager to read, then reads that one's logs and storage", async () => {
    const fetchImpl = bothEndpoints();
    await run({ fetchImpl });
    const [graph, ...chain] = requestsMade(fetchImpl);

    expect((graph?.body as { query: string }).query).toContain("poolManagers(first: 1)");
    expect(chain.every((request) => request.url === RPC_URL)).toBe(true);
    const requests = chain.flatMap(
      (request) => request.body as { method: string; params: [{ to?: string; data?: string; address?: string; topics?: string[] }] }[],
    );
    const calls = requests.filter((request) => request.method === "eth_call");
    const logs = requests.filter((request) => request.method === "eth_getLogs");
    expect(calls.length).toBe(2);
    expect(calls.every((call) => call.params[0].to === POOL_MANAGER)).toBe(true);
    expect(calls.every((call) => call.params[0].data?.startsWith(EXTSLOAD_SELECTOR))).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.params[0]).toEqual({
      address: POOL_MANAGER,
      fromBlock: "0x14af009",
      toBlock: "0x14af009",
      topics: [INITIALIZE_TOPIC, POOL_ID],
    });
  });

  it("still answers, with the state and the fee unread, when no endpoint is configured", async () => {
    const result = await run({ rpcUrl: undefined });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.matches[0]?.state).toBeNull();
    expect(result.data.matches[0]?.pool.fee).toEqual({ kind: "unread" });
  });

  it("sends the key in the header and never in the URL", async () => {
    const fetchImpl = bothEndpoints();
    await run({ fetchImpl });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];

    expect(String(url)).not.toContain(API_KEY);
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it.each([
    ["no terms", []],
    ["three terms", ["usdc", "weth", "dai"]],
    ["a term that is too short", ["a"]],
  ])("refuses %s without calling anything", async (_label, terms) => {
    const fetchImpl = bothEndpoints();
    const result = await run({ fetchImpl, terms });

    expect(result.status === "unavailable" && result.notice).toBe("invalid-search-terms");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a missing v4 subgraph as configuration, without calling anything", async () => {
    const fetchImpl = bothEndpoints();
    const result = await run({ fetchImpl, subgraphId: undefined });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-not-configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps a refused key to a configuration failure that carries nothing from the wire", async () => {
    const result = await run({
      fetchImpl: vi.fn(async () => new Response("{}", { status: 401 })),
    });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-credentials-rejected");
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });
});
