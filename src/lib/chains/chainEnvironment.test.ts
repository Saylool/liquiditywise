import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { rpcUrlFor, subgraphIdFor, v3SubgraphIdFor, v4SubgraphIdFor } from "./chainEnvironment";

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

  it("gives each chain its own v4 subgraph", () => {
    vi.stubEnv("UNISWAP_V4_ETHEREUM_SUBGRAPH_ID", "mainnet-v4");
    vi.stubEnv("UNISWAP_V4_ARBITRUM_SUBGRAPH_ID", "arbitrum-v4");
    vi.stubEnv("UNISWAP_V4_BASE_SUBGRAPH_ID", "base-v4");
    vi.stubEnv("UNISWAP_V3_BASE_SUBGRAPH_ID", "base-v3");

    expect(subgraphIdFor("v4", 1)).toBe("mainnet-v4");
    expect(subgraphIdFor("v4", 42161)).toBe("arbitrum-v4");
    expect(v4SubgraphIdFor(42161)).toBe("arbitrum-v4");
    expect(subgraphIdFor("v4", 8453)).toBe("base-v4");
    expect(subgraphIdFor("v3", 8453)).toBe("base-v3");
  });
});

describe("OP Mainnet and Polygon", () => {
  it("each have their own v3 and v4 subgraph and their own endpoint, never mainnet's", () => {
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("UNISWAP_V4_ETHEREUM_SUBGRAPH_ID", "mainnet-v4");
    vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
    vi.stubEnv("UNISWAP_V3_OPTIMISM_SUBGRAPH_ID", "optimism-v3");
    vi.stubEnv("UNISWAP_V4_OPTIMISM_SUBGRAPH_ID", "optimism-v4");
    vi.stubEnv("OPTIMISM_RPC_URL", "https://optimism.example");
    vi.stubEnv("UNISWAP_V3_POLYGON_SUBGRAPH_ID", "polygon-v3");
    vi.stubEnv("UNISWAP_V4_POLYGON_SUBGRAPH_ID", "polygon-v4");
    vi.stubEnv("POLYGON_RPC_URL", "https://polygon.example");

    expect([v3SubgraphIdFor(10), v4SubgraphIdFor(10), rpcUrlFor(10)]).toEqual([
      "optimism-v3",
      "optimism-v4",
      "https://optimism.example",
    ]);
    expect([v3SubgraphIdFor(137), v4SubgraphIdFor(137), rpcUrlFor(137)]).toEqual([
      "polygon-v3",
      "polygon-v4",
      "https://polygon.example",
    ]);
  });
});

describe("a chain whose v3 pools are not read", () => {
  it("has no v3 subgraph, rather than another chain's, and its own endpoint and v4 subgraph", () => {
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("UNISWAP_V4_UNICHAIN_SUBGRAPH_ID", "unichain-v4");
    vi.stubEnv("UNICHAIN_RPC_URL", "https://unichain.example");

    expect(v3SubgraphIdFor(130)).toBeUndefined();
    expect(subgraphIdFor("v3", 130)).toBeUndefined();
    expect(v4SubgraphIdFor(130)).toBe("unichain-v4");
    expect(rpcUrlFor(130)).toBe("https://unichain.example");
  });
});
