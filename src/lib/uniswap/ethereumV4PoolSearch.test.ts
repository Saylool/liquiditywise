import { describe, expect, it, vi } from "vitest";

import type { DataResult } from "../../schemas";
import { fetchEthereumV4PoolSearch } from "./ethereumV4PoolSearch";
import type { V4PoolDays } from "./ethereumV4PoolDays";
import { MULTICALL3_ADDRESS } from "./multicall3";
import { answerRpc, decodeAggregate3Calls } from "./testing/multicall3Endpoint";
import type { FetchLike } from "./v3SubgraphTransport";
import { DYNAMIC_FEE_FLAG, INITIALIZE_TOPIC } from "./v4PoolKey";
import { EXTSLOAD_SELECTOR } from "./v4PoolStateSlots";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const POOL_ID = "0xe500210c7ea6bfd9f69dce044b09ef384ec2b34832f132baec3b418208e3a657";
const OTHER_POOL_ID = `0x${"4f".repeat(32)}`;
const READ_AT = "2026-09-15T14:00:00.000Z";

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
const payload = {
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

/** The node: the creation log for whatever is asked, and a state word per storage read. */
const chain = (): FetchLike =>
  vi.fn(async (_url, init) =>
    new Response(
      JSON.stringify(
        answerRpc(String(init.body), {
          logs: () => [initializeLog],
          // First word of each pair is slot0, second is liquidity.
          call: (_question, index) => ({
            success: true,
            data: word(index % 2 === 0 ? (198_320n << 160n) | SQRT_PRICE : 642_953_328_768_594_464n),
          }),
        }),
      ),
      { status: 200 },
    ),
  );

const daysRead = (
  value: DataResult<V4PoolDays> = { status: "success", data: { payload, fetchedAt: READ_AT } },
) => vi.fn(async () => value);

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4PoolSearch>[0]> = {}) =>
  fetchEthereumV4PoolSearch({
    terms: ["usdc", "weth"],
    readDays: daysRead(),
    rpcUrl: RPC_URL,
    fetchImpl: chain(),
    ...overrides,
  });

const requestsMade = (fetchImpl: FetchLike) =>
  vi.mocked(fetchImpl).mock.calls.map(([url, init]) => ({
    url,
    body: JSON.parse(String(init.body)) as { method: string; params: [{ to?: string; data?: string; address?: string; topics?: string[] }] }[],
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
  });

  /*
   * The list is shared with the holdings net and may be minutes old, so the
   * page says when it was read rather than when it was rendered.
   */
  it("stamps the results with the moment the list was read", async () => {
    const result = await run();

    expect(result.status === "success" && result.data.fetchedAt).toBe(READ_AT);
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

  /*
   * The source is not asked for the terms. It cannot answer a search over every
   * v4 pool before the page stops waiting, so the week's busiest pool-days are
   * read — the same read the holdings net uses, cached and shared — and the
   * terms are matched here. Nothing typed by a visitor travels anywhere.
   */
  it("reads the shared day table once, with no terms in the asking", async () => {
    const readDays = daysRead();
    const fetchImpl = chain();
    await run({ readDays, fetchImpl });

    expect(readDays).toHaveBeenCalledTimes(1);
    expect(readDays).toHaveBeenCalledWith();
    expect(JSON.stringify(requestsMade(fetchImpl))).not.toContain("usdc");
  });

  it("runs a single term over the same list", async () => {
    const result = await run({ terms: ["weth"] });

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
  it("asks the list which PoolManager to read, then reads that one's logs and storage for the matches alone", async () => {
    const fetchImpl = chain();
    await run({ fetchImpl });
    const requests = requestsMade(fetchImpl).flatMap((request) => request.body);
    const calls = requests.filter((request) => request.method === "eth_call");
    const logs = requests.filter((request) => request.method === "eth_getLogs");

    // One aggregated call, to Multicall3, carrying the two storage words of the one matching pool.
    expect(calls).toHaveLength(1);
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
    const fetchImpl = chain();
    const result = await run({ fetchImpl, terms: ["wbtc", "dai"] });
    const requests = requestsMade(fetchImpl).flatMap((request) => request.body);

    expect(result.status === "success" && result.data.matches.map((match) => match.pool.id)).toEqual([OTHER_POOL_ID]);
    expect(result.status === "success" && result.data.matches[0]?.state).not.toBeNull();
    expect(requests.filter((request) => request.method === "eth_getLogs")).toHaveLength(0);
  });

  it("still answers, with the state and the fee unread, when no endpoint is configured", async () => {
    const result = await run({ rpcUrl: undefined });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.matches[0]?.state).toBeNull();
    expect(result.data.matches[0]?.pool.fee).toEqual({ kind: "unread" });
  });

  it.each([
    ["no terms", []],
    ["three terms", ["usdc", "weth", "dai"]],
    ["a term that is too short", ["a"]],
  ])("refuses %s without reading anything", async (_label, terms) => {
    const readDays = daysRead();
    const fetchImpl = chain();
    const result = await run({ readDays, fetchImpl, terms });

    expect(result.status === "unavailable" && result.notice).toBe("invalid-search-terms");
    expect(readDays).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["a deployment with no v4 subgraph", "market-data-not-configured", "configuration-error"],
    ["a source that would not answer", "market-data-timed-out", "timeout"],
  ])("passes %s on with its own notice, and reads no chain", async (_label, notice, reason) => {
    const fetchImpl = chain();
    const result = await run({
      fetchImpl,
      readDays: daysRead({ status: "unavailable", reason, notice } as DataResult<V4PoolDays>),
    });

    expect(result.status === "unavailable" && result.notice).toBe(notice);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a payload it cannot verify", async () => {
    const result = await run({
      readDays: daysRead({ status: "success", data: { payload: { data: null }, fetchedAt: READ_AT } }),
    });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-malformed");
  });

  it("never puts the endpoint in what it returns", async () => {
    const result = await run({ fetchImpl: vi.fn(async () => new Response("x", { status: 500 })) });

    expect(JSON.stringify(result)).not.toContain("key-that-must-never-leak");
  });
});
