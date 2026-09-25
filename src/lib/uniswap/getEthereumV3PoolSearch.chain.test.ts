import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const asked = vi.hoisted(() => ({ requests: [] as Record<string, unknown>[] }));
vi.mock("./ethereumV3PoolSearch", () => ({
  fetchEthereumV3PoolSearch: async (request: Record<string, unknown>) => {
    asked.requests.push(request);
    return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
  },
  fetchV3PoolSearchFromDays: async () => {
    throw new Error("not this path");
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  asked.requests = [];
});

describe("a pool search on a chain", () => {
  it("asks that chain's subgraph and endpoint", async () => {
    vi.stubEnv("UNISWAP_V3_ARBITRUM_SUBGRAPH_ID", "arbitrum-v3");
    vi.stubEnv("ARBITRUM_RPC_URL", "https://arbitrum.example");
    const { getEthereumV3PoolSearch } = await import("./getEthereumV3PoolSearch");

    await getEthereumV3PoolSearch(["weth", "usdc"], 42161);

    expect(asked.requests[0]).toMatchObject({
      chainId: 42161,
      subgraphId: "arbitrum-v3",
      rpcUrl: "https://arbitrum.example",
    });
  });

  it("asks mainnet's when no chain is named", async () => {
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    const { getEthereumV3PoolSearch } = await import("./getEthereumV3PoolSearch");

    await getEthereumV3PoolSearch(["weth"]);

    expect(asked.requests[0]).toMatchObject({ chainId: 1, subgraphId: "mainnet-v3" });
  });
});

describe("a pool search on a chain whose subgraph cannot filter by symbol", () => {
  it("looks through that chain's busiest days instead of asking the subgraph to search", async () => {
    vi.resetModules();
    const fromDays = vi.fn(async () => ({ status: "unavailable", reason: "timeout", notice: "market-data-timed-out" }));
    vi.doMock("./ethereumV3PoolSearch", () => ({
      fetchEthereumV3PoolSearch: vi.fn(),
      fetchV3PoolSearchFromDays: fromDays,
    }));
    vi.doMock("./getEthereumV3PoolDays", () => ({ getEthereumV3PoolDays: vi.fn() }));
    const { getEthereumV3PoolSearch } = await import("./getEthereumV3PoolSearch");

    await getEthereumV3PoolSearch(["weth", "usdc"], 8453);

    expect(fromDays).toHaveBeenCalledWith(expect.objectContaining({ chainId: 8453, terms: ["weth", "usdc"] }));
    vi.doUnmock("./ethereumV3PoolSearch");
    vi.doUnmock("./getEthereumV3PoolDays");
  });
});
