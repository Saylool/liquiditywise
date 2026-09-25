import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const asked = vi.hoisted(() => ({ requests: [] as Record<string, unknown>[] }));
vi.mock("./ethereumV3PoolSearch", () => ({
  fetchEthereumV3PoolSearch: async (request: Record<string, unknown>) => {
    asked.requests.push(request);
    return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  asked.requests = [];
});

describe("a pool search on a chain", () => {
  it("asks that chain's subgraph and endpoint", async () => {
    vi.stubEnv("UNISWAP_V3_BASE_SUBGRAPH_ID", "base-v3");
    vi.stubEnv("BASE_RPC_URL", "https://base.example");
    const { getEthereumV3PoolSearch } = await import("./getEthereumV3PoolSearch");

    await getEthereumV3PoolSearch(["weth", "usdc"], 8453);

    expect(asked.requests[0]).toMatchObject({ chainId: 8453, subgraphId: "base-v3", rpcUrl: "https://base.example" });
  });

  it("asks mainnet's when no chain is named", async () => {
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    const { getEthereumV3PoolSearch } = await import("./getEthereumV3PoolSearch");

    await getEthereumV3PoolSearch(["weth"]);

    expect(asked.requests[0]).toMatchObject({ chainId: 1, subgraphId: "mainnet-v3" });
  });
});
