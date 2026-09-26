import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../chains/chainEnvironment", () => ({
  v4SubgraphIdFor: (chainId: number) => (chainId === 8453 ? undefined : `v4-subgraph-${chainId}`),
  rpcUrlFor: (chainId: number) => `rpc-${chainId}`,
}));

const asked = vi.hoisted(() => ({ requests: [] as Record<string, unknown>[], dayChains: [] as unknown[] }));
const UNAVAILABLE = { status: "unavailable", reason: "not-found", notice: "pool-not-found" };
const record = (request: Record<string, unknown>) => {
  asked.requests.push(request);
  return UNAVAILABLE;
};

vi.mock("./ethereumV4Pool", () => ({ fetchEthereumV4Pool: async (request: Record<string, unknown>) => record(request) }));
vi.mock("./ethereumV4PairPools", () => ({
  fetchEthereumV4PairPools: async (request: Record<string, unknown>) => record(request),
}));
vi.mock("./ethereumV4PoolSearch", () => ({
  fetchEthereumV4PoolSearch: async (request: Record<string, unknown> & { readDays: () => Promise<unknown> }) => {
    await request.readDays();
    return record(request);
  },
}));
vi.mock("./ethereumV4TradedPools", () => ({
  fetchEthereumV4TradedPools: async (readDays: () => Promise<unknown>, chainId: unknown) => {
    await readDays();
    return record({ chainId });
  },
}));
vi.mock("./getEthereumV4PoolDays", () => ({
  getEthereumV4PoolDays: async (chainId: unknown) => {
    asked.dayChains.push(chainId);
    return UNAVAILABLE;
  },
}));

beforeEach(() => {
  asked.requests = [];
  asked.dayChains = [];
});

const PAIR = { analysedPoolId: null, token0Address: "0x1", token1Address: "0x2" };

describe("the v4 reads, on the chain they are asked about", () => {
  it("ask one pool of that chain's subgraph and endpoint, and name the chain", async () => {
    const { getEthereumV4Pool } = await import("./getEthereumV4Pool");

    await getEthereumV4Pool("0xabc", 42161);
    await getEthereumV4Pool("0xabc");

    expect(asked.requests.map(({ subgraphId, rpcUrl, chainId }) => [subgraphId, rpcUrl, chainId])).toEqual([
      ["v4-subgraph-42161", "rpc-42161", 42161],
      ["v4-subgraph-1", "rpc-1", 1],
    ]);
  });

  it("ask a chain with no v4 subgraph with none, rather than with mainnet's", async () => {
    const { getEthereumV4Pool } = await import("./getEthereumV4Pool");

    await getEthereumV4Pool("0xabc", 8453);

    expect(asked.requests[0]?.subgraphId).toBeUndefined();
  });

  it("ask a pair of that chain's subgraph and endpoint", async () => {
    const { getEthereumV4PairPools } = await import("./getEthereumV4PairPools");

    await getEthereumV4PairPools(PAIR, 42161);
    await getEthereumV4PairPools(PAIR);

    expect(asked.requests.map(({ subgraphId, rpcUrl, chainId }) => [subgraphId, rpcUrl, chainId])).toEqual([
      ["v4-subgraph-42161", "rpc-42161", 42161],
      ["v4-subgraph-1", "rpc-1", 1],
    ]);
  });

  it("search that chain's day table, on that chain's endpoint", async () => {
    const { getEthereumV4PoolSearch } = await import("./getEthereumV4PoolSearch");

    await getEthereumV4PoolSearch(["usdc"], 42161);
    await getEthereumV4PoolSearch(["usdc"]);

    expect(asked.dayChains).toEqual([42161, 1]);
    expect(asked.requests.map(({ rpcUrl, chainId }) => [rpcUrl, chainId])).toEqual([
      ["rpc-42161", 42161],
      ["rpc-1", 1],
    ]);
  });

  it("draw the traded pools from that chain's day table, and name it", async () => {
    const { getEthereumV4TradedPools } = await import("./getEthereumV4TradedPools");

    await getEthereumV4TradedPools(42161);
    await getEthereumV4TradedPools();

    expect(asked.dayChains).toEqual([42161, 1]);
    expect(asked.requests.map(({ chainId }) => chainId)).toEqual([42161, 1]);
  });
});
