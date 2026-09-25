import { describe, expect, it, vi } from "vitest";

import type { DataResult } from "../../schemas";
import type { V4PoolDays } from "../uniswap/ethereumV4PoolDays";
import type { FetchLike } from "../uniswap/v3SubgraphTransport";
import { readMostTraded } from "./readMostTraded";

const FETCHED_AT = "2026-09-24T12:00:00.000Z";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const v3Days: DataResult<V4PoolDays> = {
  status: "success",
  data: {
    fetchedAt: FETCHED_AT,
    payload: {
      data: {
        poolDayDatas: [
          {
            date: 1_790_208_000,
            volumeUSD: "1000",
            feesUSD: "0.5",
            pool: {
              id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
              feeTier: "500",
              totalValueLockedUSD: "1",
              poolDayData: [{ date: 1_790_208_000 }],
              token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
              token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
            },
          },
        ],
        _meta: { hasIndexingErrors: false },
      },
    },
  },
};

const v4Days: DataResult<V4PoolDays> = {
  status: "success",
  data: {
    fetchedAt: FETCHED_AT,
    payload: {
      data: {
        poolDayDatas: [
          {
            date: 1_790_208_000,
            volumeUSD: "700",
            feesUSD: "0.35",
            pool: {
              id: `0x${"e5".repeat(32)}`,
              createdAtBlockNumber: "21688329",
              tickSpacing: "10",
              hooks: `0x${"0".repeat(40)}`,
              token0: { id: `0x${"0".repeat(40)}`, symbol: "ETH", name: "Ether", decimals: "18", derivedETH: "1" },
              token1: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
            },
          },
        ],
        poolManagers: [{ id: "0x000000000004444c5dc75cb358380d2e3de08a90" }],
        _meta: { hasIndexingErrors: false },
      },
    },
  },
};

const down: DataResult<V4PoolDays> = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };

describe("reading the most-traded page", () => {
  it("reads both halves", async () => {
    const fetchImpl = vi.fn();
    const read = await readMostTraded({
      readV3Days: async () => v3Days,
      readV4Days: async () => v4Days,
      rpcUrl: undefined,
      fetchImpl,
    });

    expect(read.v3.status === "listed" && read.v3.pools.map(({ volumeUsd }) => volumeUsd)).toEqual([1000]);
    expect(read.v4?.status === "listed" && read.v4.pools.map(({ volumeUsd }) => volumeUsd)).toEqual([700]);
  });

  it("loses only the half whose source is down", async () => {
    const read = await readMostTraded({
      readV3Days: async () => down,
      readV4Days: async () => v4Days,
      rpcUrl: undefined,
      fetchImpl: vi.fn(),
    });

    expect(read.v3).toEqual({ status: "unavailable", notice: "market-data-timed-out" });
    expect(read.v4?.status).toBe("listed");

    const other = await readMostTraded({
      readV3Days: async () => v3Days,
      readV4Days: async () => down,
      rpcUrl: undefined,
      fetchImpl: vi.fn(),
    });
    expect(other.v3.status).toBe("listed");
    expect(other.v4).toEqual({ status: "unavailable", notice: "market-data-timed-out" });
  });

  it("keeps the v4 list when the chain cannot be asked, with its fees unread, and asks nothing", async () => {
    const fetchImpl = vi.fn();
    const read = await readMostTraded({
      readV3Days: async () => v3Days,
      readV4Days: async () => v4Days,
      rpcUrl: undefined,
      fetchImpl,
    });

    expect(read.v4?.status === "listed" && read.v4.pools[0]?.pool.protocolVersion === "v4" && read.v4.pools[0].pool.fee).toEqual({
      kind: "unread",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks the chain about the v4 pools it will show when it can", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -1 } })),
    );
    await readMostTraded({
      readV3Days: async () => v3Days,
      readV4Days: async () => v4Days,
      rpcUrl: "https://rpc.example",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalled();
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://rpc.example");
  });
});

describe("the most-traded page off mainnet", () => {
  it("reads no v4, and asks nothing of the chain for it", async () => {
    const fetchImpl = vi.fn();
    const read = await readMostTraded({
      chainId: 42161,
      readV3Days: async () => v3Days,
      readV4Days: null,
      rpcUrl: "https://rpc.example",
      fetchImpl,
    });

    expect(read.v4).toBeNull();
    expect(read.v3.status === "listed" && read.v3.pools.map(({ pool }) => pool.chainId)).toEqual([42161]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
