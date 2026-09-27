import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../chains/chainEnvironment", () => ({
  v3SubgraphIdFor: (chainId: number) => `v3-${chainId}`,
  v4SubgraphIdFor: (chainId: number) => `v4-${chainId}`,
  rpcUrlFor: (chainId: number) => `rpc-${chainId}`,
}));

const asked = vi.hoisted(() => ({
  v4: [] as Record<string, unknown>[],
  v3: [] as Record<string, unknown>[],
  dayChains: [] as unknown[],
  answer: { status: "success", data: "pools" } as unknown,
}));

vi.mock("./ethereumV4PairPools", () => ({
  fetchEthereumV4PairPools: async (request: Record<string, unknown> & { readDays?: () => Promise<unknown> }) => {
    asked.v4.push(request);
    await request.readDays?.();
    return asked.answer;
  },
}));
vi.mock("./ethereumV3PairFeeTiers", () => ({
  fetchEthereumV3PairFeeTiers: async (request: Record<string, unknown>) => {
    asked.v3.push(request);
    return asked.answer;
  },
}));
vi.mock("./getEthereumV4PoolDays", () => ({
  getEthereumV4PoolDays: async (chainId: unknown) => {
    asked.dayChains.push(chainId);
    return { status: "unavailable" };
  },
}));

import { readerLabel } from "./pairReads";
import { forgetV3PairFeeTiers, getEthereumV3PoolsOfPair } from "./getEthereumV3PairFeeTiers";
import { forgetV4PairPools, getEthereumV4PairPools } from "./getEthereumV4PairPools";

const PAIR = { analysedPoolId: null, token0Address: "0xAA", token1Address: "0xbb" };

beforeEach(() => {
  asked.v4 = [];
  asked.v3 = [];
  asked.dayChains = [];
  asked.answer = { status: "success", data: "pools" };
  forgetV4PairPools();
  forgetV3PairFeeTiers();
});

describe("a pair's v4 pools", () => {
  it("are read once per pair and chain for ten minutes, whatever case the addresses come in", async () => {
    await getEthereumV4PairPools(PAIR);
    await getEthereumV4PairPools({ ...PAIR, token0Address: "0xaa" });
    await getEthereumV4PairPools(PAIR, 42161);
    await getEthereumV4PairPools({ ...PAIR, analysedPoolId: "0x01" });

    expect(asked.v4).toHaveLength(3);
  });

  it("are not kept when the read failed", async () => {
    asked.answer = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
    await getEthereumV4PairPools(PAIR);
    await getEthereumV4PairPools(PAIR);

    expect(asked.v4).toHaveLength(2);
  });

  it("come from the week's day table on Base alone, whose subgraph cannot answer the pair query", async () => {
    await getEthereumV4PairPools(PAIR, 8453);
    await getEthereumV4PairPools(PAIR, 42161);
    await getEthereumV4PairPools(PAIR, 1);

    expect(asked.dayChains).toEqual([8453]);
    expect(asked.v4.map(({ subgraphId, rpcUrl, chainId }) => [subgraphId, rpcUrl, chainId])).toEqual([
      ["v4-8453", "rpc-8453", 8453],
      ["v4-42161", "rpc-42161", 42161],
      ["v4-1", "rpc-1", 1],
    ]);
  });
});

describe("a pair's v3 tiers", () => {
  it("are read once per pair and chain for ten minutes, and not kept when the read failed", async () => {
    await getEthereumV3PoolsOfPair(PAIR);
    await getEthereumV3PoolsOfPair(PAIR);
    await getEthereumV3PoolsOfPair({ ...PAIR, chainId: 8453 });
    expect(asked.v3).toHaveLength(2);

    asked.answer = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
    await getEthereumV3PoolsOfPair({ ...PAIR, chainId: 42161 });
    await getEthereumV3PoolsOfPair({ ...PAIR, chainId: 42161 });
    expect(asked.v3).toHaveLength(4);
  });

  it("wait the search timeout off mainnet, and the default on it", async () => {
    await getEthereumV3PoolsOfPair(PAIR);
    await getEthereumV3PoolsOfPair({ ...PAIR, chainId: 8453 });

    expect(asked.v3.map(({ timeoutMs }) => timeoutMs)).toEqual([undefined, 20_000]);
  });
});

describe("a pair reader's label", () => {
  it("is the reader's own on mainnet, and names the chain elsewhere", () => {
    expect(readerLabel("v4-pair-pools", 1)).toBe("v4-pair-pools");
    expect(readerLabel("v4-pair-pools", 8453)).toBe("v4-pair-pools@base");
  });
});
