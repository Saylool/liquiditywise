import { describe, expect, it, vi } from "vitest";

import { fetchEthereumV3PoolsByIds } from "./ethereumV3PoolsByIds";
import type { FetchLike } from "./v3SubgraphTransport";

const POOL = "0xd0b53d9277642d899df5c87a3966a349a798f224";
const body = {
  data: {
    pools: [
      {
        id: POOL,
        feeTier: "500",
        tick: "-196000",
        token0: { id: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: "18" },
        token1: { id: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", decimals: "6" },
      },
    ],
    _meta: { hasIndexingErrors: false },
  },
};

const read = (chainId?: 1 | 8453) =>
  fetchEthereumV3PoolsByIds({
    poolAddresses: [POOL],
    ...(chainId === undefined ? {} : { chainId }),
    apiKey: "test-key",
    subgraphId: "TestSubgraph",
    fetchImpl: vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status: 200 })),
  });

describe("the pools behind an address's positions", () => {
  it("are the chain's the subgraph indexes, pool and tokens alike", async () => {
    const result = await read(8453);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const pool = result.data[0]?.pool;
    expect([pool?.chainId, pool?.token0.chainId, pool?.token1.chainId]).toEqual([8453, 8453, 8453]);
  });

  it("are mainnet's when nothing says otherwise", async () => {
    const result = await read();

    expect(result.status === "success" && result.data[0]?.pool.chainId).toBe(1);
  });
});
