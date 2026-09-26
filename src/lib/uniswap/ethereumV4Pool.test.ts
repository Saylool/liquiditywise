import { describe, expect, it, vi } from "vitest";

import { fetchEthereumV4Pool, V4_POOL_QUERY } from "./ethereumV4Pool";
import type { FetchLike } from "./v3SubgraphTransport";
import { DYNAMIC_FEE_FLAG, INITIALIZE_TOPIC, poolIdOf, type V4PoolKey } from "./v4PoolKey";

const API_KEY = "test-graph-key-must-never-leak";
const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const HOOK = "0x0000000aa232009084bd71a5797d089aa4edfad4";

/** Mainnet's busiest hooked pool: a dynamic key, and its real id. */
const HOOKED: V4PoolKey = { currency0: USDC, currency1: WETH, fee: DYNAMIC_FEE_FLAG, tickSpacing: 10, hooks: HOOK };
const HOOKED_ID = "0xe500210c7ea6bfd9f69dce044b09ef384ec2b34832f132baec3b418208e3a657";
/** A hookless static pool of the same pair, whose id is whatever its key hashes to. */
const STATIC: V4PoolKey = { ...HOOKED, fee: 500, hooks: `0x${"0".repeat(40)}` };
const STATIC_ID = poolIdOf(STATIC) ?? "";
const SQRT_PRICE = 1584563250285286751870879006n;

const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
const addressWord = (address: string) => `0x${address.slice(2).padStart(64, "0")}`;
const logFor = (key: V4PoolKey, id: string) => ({
  address: POOL_MANAGER,
  topics: [INITIALIZE_TOPIC, id, addressWord(key.currency0), addressWord(key.currency1)],
  data: `0x${[BigInt(key.fee), BigInt(key.tickSpacing), BigInt(key.hooks), SQRT_PRICE, 0n]
    .map((value) => value.toString(16).padStart(64, "0"))
    .join("")}`,
});
const slot0 = (lpFee: bigint, protocol: bigint) =>
  (lpFee << 208n) | (((protocol << 12n) | protocol) << 184n) | (198_320n << 160n) | SQRT_PRICE;

const subgraphBody = (key: V4PoolKey, id: string) => ({
  data: {
    pool: {
      id,
      createdAtBlockNumber: "21688329",
      tickSpacing: String(key.tickSpacing),
      hooks: key.hooks,
      token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6" },
      token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18" },
    },
    poolManagers: [{ id: POOL_MANAGER }],
    _meta: { hasIndexingErrors: false },
  },
});

/** One fetch playing both parts: the gateway, then the chain answering the log and the state. */
const bothEndpoints = (key: V4PoolKey, id: string, stored: bigint): FetchLike =>
  vi.fn(async (url, init) => {
    if (url === RPC_URL) {
      const requests = JSON.parse(String(init.body)) as { id: number; method: string }[];
      return new Response(
        JSON.stringify(
          requests.map((request) => ({
            jsonrpc: "2.0",
            id: request.id,
            result: request.method === "eth_getLogs" ? [logFor(key, id)] : word(stored),
          })),
        ),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(subgraphBody(key, id)), { status: 200 });
  });

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4Pool>[0]> = {}) =>
  fetchEthereumV4Pool({
    poolId: HOOKED_ID,
    apiKey: API_KEY,
    subgraphId: "TestV4SubgraphId",
    rpcUrl: RPC_URL,
    fetchImpl: bothEndpoints(HOOKED, HOOKED_ID, slot0(0n, 0n)),
    ...overrides,
  });

describe("fetchEthereumV4Pool", () => {
  it("reads a hooked pool: dynamic by its key, whatever its state stores", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.id).toBe(HOOKED_ID);
    expect(result.data.fee).toEqual({ kind: "dynamic", currentFeePpm: null });
    expect(result.data.protocolFee).toEqual({ zeroForOnePpm: 0, oneForZeroPpm: 0 });
    expect(result.data.hookAddress).toBe(HOOK);
  });

  it("names the chain it was asked on, and mainnet when not said", async () => {
    const arbitrum = await run({ chainId: 42161 });
    const mainnet = await run();

    expect(arbitrum.status === "success" && arbitrum.data.chainId).toBe(42161);
    expect(mainnet.status === "success" && mainnet.data.chainId).toBe(1);
  });

  /* The ETH/USDC pool as the chain holds it: 500 ppm in the key, 125 ppm to the protocol. */
  it("reads a static pool's fee from its key and the protocol's cut from its state", async () => {
    const result = await run({ poolId: STATIC_ID, fetchImpl: bothEndpoints(STATIC, STATIC_ID, slot0(500n, 125n)) });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.fee).toEqual({ kind: "static", feePpm: 500 });
    expect(result.data.protocolFee).toEqual({ zeroForOnePpm: 125, oneForZeroPpm: 125 });
  });

  it("asks the indexer for the pool's creation block and manager, and not for its fee", async () => {
    const fetchImpl = bothEndpoints(HOOKED, HOOKED_ID, slot0(0n, 0n));
    await run({ fetchImpl });
    const sent = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as { query: string; variables: unknown };

    expect(sent.query).toBe(V4_POOL_QUERY);
    expect(sent.query).toContain("createdAtBlockNumber");
    expect(sent.query).toContain("poolManagers(first: 1)");
    expect(sent.query).not.toContain("feeTier");
    expect(sent.variables).toEqual({ poolId: HOOKED_ID });
  });

  it("asks the chain only after the indexer has said where to look", async () => {
    const fetchImpl = bothEndpoints(HOOKED, HOOKED_ID, slot0(0n, 0n));
    await run({ fetchImpl });
    const urls = vi.mocked(fetchImpl).mock.calls.map(([url]) => url);

    expect(urls).toHaveLength(2);
    expect(urls[1]).toBe(RPC_URL);
  });

  /* A page about one pool has nothing to show without its fee, so this is a failure, not an unread row. */
  it("fails, as configuration, when there is no endpoint to ask", async () => {
    const result = await run({ rpcUrl: undefined });

    expect(result.status === "unavailable" && result.notice).toBe("chain-data-not-configured");
  });

  it("refuses a pool whose state stores a fee other than its key's", async () => {
    const result = await run({ poolId: STATIC_ID, fetchImpl: bothEndpoints(STATIC, STATIC_ID, slot0(3000n, 0n)) });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-malformed");
  });

  it("reports a pool the indexer has never heard of, without asking the chain", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      new Response(JSON.stringify({ data: { pool: null, poolManagers: [], _meta: null } }), { status: 200 }),
    );
    const result = await run({ fetchImpl });

    expect(result.status === "unavailable" && result.notice).toBe("pool-not-found");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses an id that is not a pool id without calling anything", async () => {
    const fetchImpl = bothEndpoints(HOOKED, HOOKED_ID, slot0(0n, 0n));
    const result = await run({ poolId: `0x${"a".repeat(40)}`, fetchImpl });

    expect(result.status === "unavailable" && result.notice).toBe("invalid-pool-address");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps both credentials out of a failure", async () => {
    const result = await run({ fetchImpl: vi.fn(async () => new Response("{}", { status: 401 })) });

    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain(RPC_URL);
  });
});
