import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const asked = vi.hoisted(() => ({ requests: [] as Record<string, unknown>[] }));
vi.mock("./ethereumV3PairFeeTiers", () => ({
  fetchEthereumV3PairFeeTiers: async (request: Record<string, unknown>) => {
    asked.requests.push(request);
    return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  asked.requests = [];
});

const pool = (chainId: number) =>
  ({
    protocolVersion: "v3",
    chainId,
    id: `0x${"a".repeat(40)}`,
    token0: { chainId, symbol: "WETH", decimals: 18, address: `0x${"1".repeat(40)}` },
    token1: { chainId, symbol: "USDC", decimals: 6, address: `0x${"2".repeat(40)}` },
    feePpm: 500,
  }) as const;

describe("reading a pair's tiers", () => {
  it("asks the subgraph and the endpoint of the pool's own chain", async () => {
    vi.stubEnv("UNISWAP_V3_ARBITRUM_SUBGRAPH_ID", "arbitrum-v3");
    vi.stubEnv("ARBITRUM_RPC_URL", "https://arbitrum.example");
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    const { getEthereumV3PairFeeTiers } = await import("./getEthereumV3PairFeeTiers");

    await getEthereumV3PairFeeTiers(pool(42161));

    expect(asked.requests[0]).toMatchObject({
      chainId: 42161,
      subgraphId: "arbitrum-v3",
      rpcUrl: "https://arbitrum.example",
    });
  });
});
