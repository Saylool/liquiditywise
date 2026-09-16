import { describe, expect, it, vi } from "vitest";

import { blockTag, fetchEthereumV4PoolKeys, initializeFilter, LOG_BATCH_SIZE } from "./ethereumV4PoolKeys";
import type { FetchLike } from "./v3SubgraphTransport";
import { DYNAMIC_FEE_FLAG, INITIALIZE_TOPIC, poolIdOf, type V4PoolKey } from "./v4PoolKey";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const NO_HOOK = `0x${"0".repeat(40)}`;

/** Keys that differ in fee only, so each pool has an id of its own that its key hashes to. */
const keyAt = (fee: number): V4PoolKey => ({ currency0: USDC, currency1: WETH, fee, tickSpacing: 10, hooks: NO_HOOK });
const idOf = (key: V4PoolKey) => {
  const id = poolIdOf(key);
  if (id === null) throw new Error("fixture key should hash");
  return id;
};

const addressWord = (address: string) => `0x${address.slice(2).padStart(64, "0")}`;
const logFor = (key: V4PoolKey) => ({
  address: POOL_MANAGER,
  topics: [INITIALIZE_TOPIC, idOf(key), addressWord(key.currency0), addressWord(key.currency1)],
  data: `0x${[BigInt(key.fee), BigInt(key.tickSpacing), BigInt(key.hooks), 1n, 0n]
    .map((value) => value.toString(16).padStart(64, "0"))
    .join("")}`,
});

type Filter = { address: string; fromBlock: string; toBlock: string; topics: string[] };

/** A PoolManager whose logs are `answer(filter)`: an array of logs, or `null` for a refused request. */
const endpoint = (answer: (filter: Filter) => unknown[] | null): FetchLike =>
  vi.fn(async (_url, init) => {
    const requests = JSON.parse(String(init.body)) as { id: number; method: string; params: [Filter] }[];

    return new Response(
      JSON.stringify(
        requests.map((request) => {
          const logs = request.method === "eth_getLogs" ? answer(request.params[0]) : null;

          return logs === null
            ? { jsonrpc: "2.0", id: request.id, error: { code: 429, message: "slow down" } }
            : { jsonrpc: "2.0", id: request.id, result: logs };
        }),
      ),
      { status: 200 },
    );
  });

/** Answers each filter with the log of whichever fixture key hashes to the id it asks about. */
const holding = (...keys: readonly V4PoolKey[]): FetchLike =>
  endpoint((filter) => keys.filter((key) => idOf(key) === filter.topics[1]).map(logFor));

const request = (key: V4PoolKey, createdAtBlockNumber = "21688329") => ({ id: idOf(key), createdAtBlockNumber });

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4PoolKeys>[0]> = {}) =>
  fetchEthereumV4PoolKeys({
    pools: [request(keyAt(500)), request(keyAt(3000))],
    poolManager: POOL_MANAGER,
    rpcUrl: RPC_URL,
    fetchImpl: holding(keyAt(500), keyAt(3000)),
    ...overrides,
  });

describe("blockTag", () => {
  it("writes a decimal block number as the hex quantity eth_getLogs takes", () => {
    expect(blockTag("21688329")).toBe("0x14af009");
    expect(blockTag("0")).toBe("0x0");
  });

  it.each(["", "abc", "-1", "01", "1.5", "0x10"])("refuses %j", (value) => {
    expect(blockTag(value)).toBeNull();
  });
});

describe("initializeFilter", () => {
  it("asks one block, one contract, one event, one pool", () => {
    expect(initializeFilter(POOL_MANAGER, idOf(keyAt(500)), "0x14af009")).toEqual({
      address: POOL_MANAGER,
      fromBlock: "0x14af009",
      toBlock: "0x14af009",
      topics: [INITIALIZE_TOPIC, idOf(keyAt(500))],
    });
  });
});

describe("fetchEthereumV4PoolKeys", () => {
  it("reads each pool's key out of its Initialize log", async () => {
    const keys = await run();

    expect(keys.get(idOf(keyAt(500)))).toEqual(keyAt(500));
    expect(keys.get(idOf(keyAt(3000)))).toEqual(keyAt(3000));
    expect(keys.size).toBe(2);
  });

  it("reads a dynamic key as the flag it carries", async () => {
    const dynamic: V4PoolKey = { ...keyAt(DYNAMIC_FEE_FLAG), hooks: `0x${"1".repeat(36)}00c0` };
    const keys = await run({ pools: [request(dynamic)], fetchImpl: holding(dynamic) });

    expect(keys.get(idOf(dynamic))?.fee).toBe(DYNAMIC_FEE_FLAG);
  });

  it("asks at the block the indexer named, of the manager the indexer named", async () => {
    const fetchImpl = holding(keyAt(500));
    await run({ pools: [request(keyAt(500), "21688329")], fetchImpl });

    const sent = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as { method: string; params: [Filter] }[];
    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe("eth_getLogs");
    expect(sent[0]?.params[0]).toEqual(initializeFilter(POOL_MANAGER, idOf(keyAt(500)), "0x14af009"));
  });

  /* A log that is not this pool's — here, another pool's key under this pool's filter — is refused, not believed. */
  it("leaves a pool out when the log that came back does not hash to its id", async () => {
    const fetchImpl = endpoint(() => [logFor(keyAt(3000))]);
    const keys = await run({ pools: [request(keyAt(500))], fetchImpl });

    expect(keys.size).toBe(0);
  });

  it("leaves a pool out when its request was refused, and keeps the rest", async () => {
    const fetchImpl = endpoint((filter) => (filter.topics[1] === idOf(keyAt(500)) ? null : [logFor(keyAt(3000))]));
    const keys = await run({ fetchImpl });

    expect(keys.has(idOf(keyAt(500)))).toBe(false);
    expect(keys.has(idOf(keyAt(3000)))).toBe(true);
  });

  it("leaves a pool out when no log came back", async () => {
    const keys = await run({ fetchImpl: endpoint(() => []) });

    expect(keys.size).toBe(0);
  });

  it("answers with nothing, not a failure, when no endpoint is configured", async () => {
    const fetchImpl = holding(keyAt(500));
    const keys = await run({ rpcUrl: undefined, fetchImpl });

    expect(keys.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([null, "", `0x${"0".repeat(40)}`, "not-an-address"])(
    "reads nothing when the manager address is %j",
    async (poolManager) => {
      const fetchImpl = holding(keyAt(500));
      const keys = await run({ poolManager, fetchImpl });

      expect(keys.size).toBe(0);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("skips a pool whose id or block is unusable rather than refusing the batch", async () => {
    const keys = await run({
      pools: [{ id: "0xnope", createdAtBlockNumber: "1" }, request(keyAt(500), "abc"), request(keyAt(3000))],
    });

    expect(keys.size).toBe(1);
    expect(keys.has(idOf(keyAt(3000)))).toBe(true);
  });

  /* Smaller batches than a storage read's: a log query costs the endpoint about three reads. */
  it("splits a large sweep into small batches", async () => {
    const many = Array.from({ length: LOG_BATCH_SIZE + 1 }, (_u, index) => keyAt(index + 1));
    const fetchImpl = holding(...many);
    const keys = await run({ pools: many.map((key) => request(key)), fetchImpl });

    expect(LOG_BATCH_SIZE).toBeLessThan(25);
    expect(keys.size).toBe(LOG_BATCH_SIZE + 1);
    expect(vi.mocked(fetchImpl).mock.calls.length).toBe(2);
  });

  /*
   * A batch the endpoint refused costs its pools their key and nothing else.
   * Measured live: a sweep of two hundred and fifty was refused from the
   * seventh batch on, and a reader that threw away the first six with it
   * published every pool as unread.
   */
  it("keeps what the other batches answered when one is refused", async () => {
    const many = Array.from({ length: LOG_BATCH_SIZE + 1 }, (_u, index) => keyAt(index + 1));
    const answering = holding(...many);
    let call = 0;
    const flaky: FetchLike = async (url, init) => {
      call += 1;
      return call === 1 ? new Response("nope", { status: 429 }) : answering(url, init);
    };
    const keys = await run({ pools: many.map((key) => request(key)), fetchImpl: flaky });

    expect(keys.size).toBe(1);
    expect(keys.has(idOf(keyAt(LOG_BATCH_SIZE + 1)))).toBe(true);
  });
});
