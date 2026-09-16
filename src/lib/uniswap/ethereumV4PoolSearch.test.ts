import { describe, expect, it, vi } from "vitest";

import { fetchEthereumV4PoolSearch } from "./ethereumV4PoolSearch";
import { tradedWindowStart, V4_TRADED_POOL_DAYS_LIMIT, V4_TRADED_POOLS_QUERY } from "./ethereumV4TradedPools";
import { MULTICALL3_ADDRESS } from "./multicall3";
import { answerRpc, decodeAggregate3Calls } from "./testing/multicall3Endpoint";
import type { FetchLike } from "./v3SubgraphTransport";
import { DYNAMIC_FEE_FLAG, INITIALIZE_TOPIC } from "./v4PoolKey";
import { EXTSLOAD_SELECTOR } from "./v4PoolStateSlots";

const API_KEY = "test-graph-key-must-never-leak";
const SUBGRAPH_ID = "TestStableV4SubgraphId";
const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const POOL_ID = "0xe500210c7ea6bfd9f69dce044b09ef384ec2b34832f132baec3b418208e3a657";
const OTHER_POOL_ID = `0x${"4f".repeat(32)}`;
const NOW = new Date("2026-09-15T14:00:00.000Z");

const usdcWeth = {
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
};

/** A pool of the week that no fixture search asks for, so its chain reads must never happen. */
const wbtcDai = {
  id: OTHER_POOL_ID,
  createdAtBlockNumber: "21700000",
  tickSpacing: "60",
  hooks: `0x${"0".repeat(40)}`,
  token0: {
    id: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    symbol: "WBTC",
    name: "Wrapped BTC",
    decimals: "8",
    derivedETH: "30",
  },
  token1: {
    id: "0x6b175474e89094c44da98b954eedeac495271d0f",
    symbol: "DAI",
    name: "Dai",
    decimals: "18",
    derivedETH: "0.0004",
  },
};

/** The week's busiest pool-days: the hooked pool on two of its days, the other on one. */
const subgraphBody = {
  data: {
    poolDayDatas: [{ pool: usdcWeth }, { pool: wbtcDai }, { pool: usdcWeth }],
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
 * node for the `eth_getLogs` batch and the aggregated storage reads after it.
 */
const bothEndpoints = (): FetchLike =>
  vi.fn(async (url, init) => {
    if (url === RPC_URL) {
      return new Response(
        JSON.stringify(
          answerRpc(String(init.body), {
            logs: () => [initializeLog],
            // First word of each pair is slot0, second is liquidity.
            call: (_question, index) => ({
              success: true,
              data: word(index % 2 === 0 ? ((198_320n) << 160n) | SQRT_PRICE : 642_953_328_768_594_464n),
            }),
          }),
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
  it("returns the pools of the week that match the terms, with their state from the chain", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.matches).toHaveLength(1);
    expect(result.data.matches[0]?.pool.id).toBe(POOL_ID);
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

  /*
   * The source is not asked for the terms. It cannot answer a search over every
   * v4 pool before the page stops waiting, so the week's busiest pool-days are
   * read — the same request the holdings net is read with — and the terms are
   * matched here. Nothing typed by a visitor travels anywhere.
   */
  it("asks for the week's busiest pool-days, and keeps the terms out of the request", async () => {
    const fetchImpl = bothEndpoints();
    await run({ fetchImpl });
    const [graph] = requestsMade(fetchImpl);
    const body = graph?.body as { query: string; variables: Record<string, unknown> };

    expect(body.query).toBe(V4_TRADED_POOLS_QUERY);
    expect(body.variables).toEqual({ from: tradedWindowStart(NOW), limit: V4_TRADED_POOL_DAYS_LIMIT });
    expect(JSON.stringify(body)).not.toContain("usdc");
  });

  it("runs a single term over the same window", async () => {
    const fetchImpl = bothEndpoints();
    const result = await run({ fetchImpl, terms: ["weth"] });
    const body = requestsMade(fetchImpl)[0]?.body as { query: string; variables: unknown };

    expect(body.query).toBe(V4_TRADED_POOLS_QUERY);
    expect(body.variables).toEqual({ from: tradedWindowStart(NOW), limit: V4_TRADED_POOL_DAYS_LIMIT });
    expect(result.status === "success" && result.data.matches.map((match) => match.pool.id)).toEqual([POOL_ID]);
  });

  it("matches a pair the other way round", async () => {
    const result = await run({ terms: ["weth", "usdc"] });

    expect(result.status === "success" && result.data.matches.map((match) => match.pool.id)).toEqual([POOL_ID]);
  });

  it("answers with an empty list, which is a real answer, when nothing of the week matches", async () => {
    const result = await run({ terms: ["pepe"] });

    expect(result.status).toBe("success");
    expect(result.status === "success" && result.data.matches).toEqual([]);
  });

  /* The address the chain reads go to comes from the answer, not from here — and only the matching pools are read. */
  it("asks the source which PoolManager to read, then reads that one's logs and storage for the matches alone", async () => {
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
    // One aggregated call, to Multicall3, carrying the two storage words of the one matching pool.
    expect(calls.length).toBe(1);
    expect(calls[0]?.params[0].to).toBe(MULTICALL3_ADDRESS);
    const questions = decodeAggregate3Calls(calls[0]?.params[0].data ?? "");
    expect(questions).toHaveLength(2);
    expect(questions.every((question) => question.to === POOL_MANAGER)).toBe(true);
    expect(questions.every((question) => question.data.startsWith(EXTSLOAD_SELECTOR))).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.params[0]).toEqual({
      address: POOL_MANAGER,
      fromBlock: "0x14af009",
      toBlock: "0x14af009",
      topics: [INITIALIZE_TOPIC, POOL_ID],
    });
  });

  /* The window is cut by the terms before the chain is asked, not by anything fixed. */
  it("reads the chain for the pools that answer the terms, whichever they are", async () => {
    const fetchImpl = bothEndpoints();
    const result = await run({ fetchImpl, terms: ["wbtc", "dai"] });
    const [, ...chain] = requestsMade(fetchImpl);
    const requests = chain.flatMap((request) => request.body as { method: string; params: [{ data?: string }] }[]);
    const aggregate = requests.find((request) => request.method === "eth_call");

    expect(result.status === "success" && result.data.matches.map((match) => match.pool.id)).toEqual([OTHER_POOL_ID]);
    expect(result.status === "success" && result.data.matches[0]?.state).not.toBeNull();
    expect(decodeAggregate3Calls(aggregate?.params[0].data ?? "")).toHaveLength(2);
    expect(requests.filter((request) => request.method === "eth_getLogs")).toHaveLength(0);
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
