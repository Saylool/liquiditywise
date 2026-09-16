import { describe, expect, it, vi } from "vitest";

import type { V3PoolMetadata } from "../../schemas";
import { balanceOfCalldata } from "./erc20BalanceAdapter";
import { fetchEthereumV3PoolReserves } from "./ethereumV3PoolReserves";
import { MULTICALL3_ADDRESS } from "./multicall3";
import { decodeAggregate3Calls, rpcEndpoint } from "./testing/multicall3Endpoint";
import type { FetchLike } from "./v3SubgraphTransport";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const poolAddress = (index: number) => `0x${index.toString(16).padStart(40, "0")}`;
const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

/** The three fields the read uses, on the metadata shape it takes. */
const pool = (index: number, token0: string, token1: string): V3PoolMetadata =>
  ({
    protocolVersion: "v3",
    chainId: 1,
    id: poolAddress(index),
    token0: { chainId: 1, address: token0, symbol: "T0", decimals: 18 },
    token1: { chainId: 1, address: token1, symbol: "T1", decimals: 18 },
    feeTier: 500,
  }) as unknown as V3PoolMetadata;

const POOLS = [pool(1, USDC, WETH), pool(2, DAI, WETH)];

/** The node and Multicall3: each token answers what each pool holds, or `null` for a question that reverts. */
const endpoint = (amountFor: (token: string, holder: string) => bigint | null, code?: string): FetchLike =>
  vi.fn(
    rpcEndpoint({
      ...(code === undefined ? {} : { code }),
      call: (question) => {
        const amount = amountFor(question.to, `0x${question.data.slice(-40)}`);
        return amount === null ? { success: false, data: "0x" } : { success: true, data: word(amount) };
      },
    }),
  );

const run = (overrides: Partial<Parameters<typeof fetchEthereumV3PoolReserves>[0]> = {}) =>
  fetchEthereumV3PoolReserves({
    pools: POOLS,
    rpcUrl: RPC_URL,
    fetchImpl: endpoint((token) => (token === WETH ? 7n : 5n)),
    ...overrides,
  });

const questionsSent = (fetchImpl: FetchLike) => {
  const entries = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as {
    method: string;
    params: [{ to: string; data: string } | string];
  }[];
  const aggregate = entries.find((entry) => entry.method === "eth_call")?.params[0] as { to: string; data: string };
  return { outer: aggregate, questions: decodeAggregate3Calls(aggregate.data) };
};

describe("fetchEthereumV3PoolReserves", () => {
  it("reports both balances of each pool, in the tokens' own base units", async () => {
    const reserves = await run();

    expect(reserves.get(poolAddress(1))).toEqual({ token0: "5", token1: "7" });
    expect(reserves.get(poolAddress(2))).toEqual({ token0: "5", token1: "7" });
  });

  /* Two questions per pool, each asking a token what the pool's own address holds, all in one call. */
  it("asks both tokens what the pool holds, inside one aggregated call", async () => {
    const fetchImpl = endpoint(() => 1n);
    await run({ fetchImpl });
    const { outer, questions } = questionsSent(fetchImpl);

    expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
    expect(outer.to).toBe(MULTICALL3_ADDRESS);
    expect(questions).toEqual([
      { to: USDC, data: balanceOfCalldata(poolAddress(1)) },
      { to: WETH, data: balanceOfCalldata(poolAddress(1)) },
      { to: DAI, data: balanceOfCalldata(poolAddress(2)) },
      { to: WETH, data: balanceOfCalldata(poolAddress(2)) },
    ]);
  });

  /* Both or neither: half a pool's reserves cannot be compared with another pool's. */
  it("leaves a pool out when either of its questions was refused, and keeps the rest", async () => {
    const reserves = await run({ fetchImpl: endpoint((token, holder) => (token === DAI && holder === poolAddress(2) ? null : 1n)) });

    expect(reserves.has(poolAddress(1))).toBe(true);
    expect(reserves.has(poolAddress(2))).toBe(false);
  });

  /* A question that reverted may still return thirty-two bytes; those bytes are not a balance. */
  it("does not read a reverted question's bytes as a balance, whatever their shape", async () => {
    const fetchImpl: FetchLike = rpcEndpoint({
      call: (question) => (question.to === DAI ? { success: false, data: word(5n) } : { success: true, data: word(1n) }),
    });
    const reserves = await run({ fetchImpl });

    expect(reserves.has(poolAddress(1))).toBe(true);
    expect(reserves.has(poolAddress(2))).toBe(false);
  });

  it("leaves a pool out when an answer is not a word", async () => {
    const fetchImpl: FetchLike = rpcEndpoint({
      call: (question) => ({ success: true, data: question.to === USDC ? "0x01" : word(1n) }),
    });
    const reserves = await run({ fetchImpl });

    expect(reserves.has(poolAddress(1))).toBe(false);
    expect(reserves.has(poolAddress(2))).toBe(true);
  });

  /* An unread balance is not an empty pool: nothing is published, and nothing is zero. */
  it("answers with nothing when the aggregated call is refused", async () => {
    const reserves = await run({ fetchImpl: rpcEndpoint({ aggregate: null }) });

    expect(reserves.size).toBe(0);
  });

  it("answers with nothing when the helper's code is not Multicall3's", async () => {
    const reserves = await run({ fetchImpl: endpoint(() => 1n, "0x") });

    expect(reserves.size).toBe(0);
  });

  it("answers with nothing when the request fails", async () => {
    const reserves = await run({ fetchImpl: vi.fn(async () => new Response("nope", { status: 500 })) });

    expect(reserves.size).toBe(0);
  });

  it.each([
    ["no endpoint", { rpcUrl: undefined }],
    ["a blank endpoint", { rpcUrl: "   " }],
    ["no pools", { pools: [] }],
  ])("reads nothing with %s, without calling out", async (_label, overrides) => {
    const fetchImpl = endpoint(() => 1n);
    const reserves = await run({ fetchImpl, ...overrides });

    expect(reserves.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never puts the endpoint in what it returns", async () => {
    const reserves = await run({ fetchImpl: vi.fn(async () => new Response("x", { status: 500 })) });

    expect(JSON.stringify([...reserves])).not.toContain("key-that-must-never-leak");
  });
});
