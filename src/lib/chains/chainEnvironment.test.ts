import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { rpcUrlFor, subgraphIdFor, v3SubgraphIdFor } from "./chainEnvironment";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("which source serves which chain", () => {
  it("gives each chain its own v3 subgraph and its own endpoint", () => {
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("UNISWAP_V3_BASE_SUBGRAPH_ID", "base-v3");
    vi.stubEnv("UNISWAP_V3_ARBITRUM_SUBGRAPH_ID", "arbitrum-v3");
    vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
    vi.stubEnv("BASE_RPC_URL", "https://base.example");
    vi.stubEnv("ARBITRUM_RPC_URL", "https://arbitrum.example");

    expect([v3SubgraphIdFor(1), v3SubgraphIdFor(8453), v3SubgraphIdFor(42161)]).toEqual([
      "mainnet-v3",
      "base-v3",
      "arbitrum-v3",
    ]);
    expect([rpcUrlFor(1), rpcUrlFor(8453), rpcUrlFor(42161)]).toEqual([
      "https://mainnet.example",
      "https://base.example",
      "https://arbitrum.example",
    ]);
  });

  it("has no v4 subgraph off mainnet, rather than mainnet's", () => {
    vi.stubEnv("UNISWAP_V4_ETHEREUM_SUBGRAPH_ID", "mainnet-v4");
    vi.stubEnv("UNISWAP_V3_BASE_SUBGRAPH_ID", "base-v3");

    expect(subgraphIdFor("v4", 1)).toBe("mainnet-v4");
    expect(subgraphIdFor("v4", 8453)).toBeUndefined();
    expect(subgraphIdFor("v3", 8453)).toBe("base-v3");
  });
});
