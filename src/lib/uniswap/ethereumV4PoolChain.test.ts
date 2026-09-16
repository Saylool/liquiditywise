import { describe, expect, it, vi } from "vitest";

import { fetchEthereumV4PoolChain } from "./ethereumV4PoolChain";
import type { FetchLike } from "./v3SubgraphTransport";
import { DYNAMIC_FEE_FLAG, INITIALIZE_TOPIC, poolIdOf, type V4PoolKey } from "./v4PoolKey";
import { EXTSLOAD_SELECTOR, poolStateSlot, SLOT0_OFFSET } from "./v4PoolStateSlots";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

/** The ETH/USDC-shaped static pool: 500 ppm in the key, 125 ppm to the protocol each way. */
const KEY: V4PoolKey = { currency0: USDC, currency1: WETH, fee: 500, tickSpacing: 10, hooks: `0x${"0".repeat(40)}` };
const idOf = (key: V4PoolKey) => {
  const id = poolIdOf(key);
  if (id === null) throw new Error("fixture key should hash");
  return id;
};
const POOL_ID = idOf(KEY);
const SQRT_PRICE = 1584563250285286751870879006n;

const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
const addressWord = (address: string) => `0x${address.slice(2).padStart(64, "0")}`;
const logFor = (key: V4PoolKey, id = idOf(key)) => ({
  address: POOL_MANAGER,
  topics: [INITIALIZE_TOPIC, id, addressWord(key.currency0), addressWord(key.currency1)],
  data: `0x${[BigInt(key.fee), BigInt(key.tickSpacing), BigInt(key.hooks), SQRT_PRICE, 0n]
    .map((value) => value.toString(16).padStart(64, "0"))
    .join("")}`,
});
const slot0 = (lpFee: bigint, protocolOneForZero: bigint, protocolZeroForOne: bigint, sqrtPrice = SQRT_PRICE) =>
  (lpFee << 208n) | (((protocolOneForZero << 12n) | protocolZeroForOne) << 184n) | (198_320n << 160n) | sqrtPrice;

type Sent = { id: number; method: string; params: unknown[] };

/** A chain answering the log request with `logs` and the state request with `stored`. */
const chain = (logs: unknown, stored: unknown): FetchLike =>
  vi.fn(async (_url, init) => {
    const requests = JSON.parse(String(init.body)) as Sent[];

    return new Response(
      JSON.stringify(
        requests.map((request) => ({
          jsonrpc: "2.0",
          id: request.id,
          result: request.method === "eth_getLogs" ? logs : stored,
        })),
      ),
      { status: 200 },
    );
  });

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4PoolChain>[0]> = {}) =>
  fetchEthereumV4PoolChain({
    poolId: POOL_ID,
    createdAtBlockNumber: "21688329",
    poolManager: POOL_MANAGER,
    rpcUrl: RPC_URL,
    fetchImpl: chain([logFor(KEY)], word(slot0(500n, 125n, 125n))),
    ...overrides,
  });

describe("fetchEthereumV4PoolChain", () => {
  it("reads the key from the log and the fees from the state", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.key).toEqual(KEY);
    expect(result.data.fees).toEqual({ lpFeePpm: 500, protocolFee: { zeroForOnePpm: 125, oneForZeroPpm: 125 } });
  });

  it("reads a dynamic key and a stored fee of zero", async () => {
    const dynamic: V4PoolKey = { ...KEY, fee: DYNAMIC_FEE_FLAG, hooks: `0x${"1".repeat(36)}00c0` };
    const result = await run({ poolId: idOf(dynamic), fetchImpl: chain([logFor(dynamic)], word(slot0(0n, 0n, 0n))) });

    expect(result.status === "success" && result.data.key?.fee).toBe(DYNAMIC_FEE_FLAG);
    expect(result.status === "success" && result.data.fees?.lpFeePpm).toBe(0);
  });

  /* One HTTP request: the log and the storage word travel together. */
  it("asks for both in one batch, of the manager and the block the indexer named", async () => {
    const fetchImpl = chain([logFor(KEY)], word(slot0(500n, 125n, 125n)));
    await run({ fetchImpl });

    expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
    const sent = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as Sent[];
    expect(sent.map((request) => request.method)).toEqual(["eth_getLogs", "eth_call"]);
    expect(sent[0]?.params[0]).toEqual({
      address: POOL_MANAGER,
      fromBlock: "0x14af009",
      toBlock: "0x14af009",
      topics: [INITIALIZE_TOPIC, POOL_ID],
    });
    expect(sent[1]?.params[0]).toEqual({
      to: POOL_MANAGER,
      data: `${EXTSLOAD_SELECTOR}${poolStateSlot(POOL_ID, SLOT0_OFFSET)?.slice(2)}`,
    });
  });

  it.each([undefined, "", "   "])("refuses to run with the endpoint %j, and says so as configuration", async (rpcUrl) => {
    const fetchImpl = chain([logFor(KEY)], word(slot0(500n, 125n, 125n)));
    const result = await run({ rpcUrl, fetchImpl });

    expect(result.status === "unavailable" && result.notice).toBe("chain-data-not-configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["no manager", { poolManager: null }],
    ["a manager that is not an address", { poolManager: "0x1234" }],
    ["a block that is not a number", { createdAtBlockNumber: "soon" }],
  ])("reports the indexer's answer as malformed when it names %s", async (_label, overrides) => {
    const fetchImpl = chain([logFor(KEY)], word(slot0(500n, 125n, 125n)));
    const result = await run({ ...overrides, fetchImpl });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-malformed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a pool id without calling out", async () => {
    const fetchImpl = chain([logFor(KEY)], word(slot0(500n, 125n, 125n)));
    const result = await run({ poolId: "0xnope", fetchImpl });

    expect(result.status === "unavailable" && result.notice).toBe("invalid-pool-address");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  /*
   * No log at the named block, or none that hashes to the id, is the indexer
   * and the chain disagreeing about the pool — the v3 read's own failure.
   */
  it.each([
    ["no log at the block", []],
    ["a log for another pool", [logFor({ ...KEY, fee: 3000 })]],
    ["a log that does not decode", [{ address: POOL_MANAGER, topics: [INITIALIZE_TOPIC], data: "0x" }]],
  ])("reports %s as the two sources disagreeing", async (_label, logs) => {
    const result = await run({ fetchImpl: chain(logs, word(slot0(500n, 125n, 125n))) });

    expect(result.status === "unavailable" && result.notice).toBe("pool-configuration-inconsistent");
  });

  it("reports a pool the manager has no state for as the two sources disagreeing", async () => {
    const result = await run({ fetchImpl: chain([logFor(KEY)], word(slot0(500n, 125n, 125n, 0n))) });

    expect(result.status === "unavailable" && result.notice).toBe("pool-configuration-inconsistent");
  });

  it.each([
    ["not a word", "0x"],
    ["not a string", 5],
    ["missing", undefined],
  ])("reports a state word that is %s as unreadable", async (_label, stored) => {
    const result = await run({ fetchImpl: chain([logFor(KEY)], stored) });

    expect(result.status === "unavailable" && result.notice).toBe("chain-data-unreadable");
  });

  it("carries the transport's own failure, and nothing from the wire", async () => {
    const result = await run({ fetchImpl: vi.fn(async () => new Response("secret-ish body", { status: 500 })) });

    expect(result.status === "unavailable" && result.notice).toBe("chain-data-unreachable");
    expect(JSON.stringify(result)).not.toContain(RPC_URL);
  });
});
