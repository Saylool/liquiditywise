import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { upstreamProbes } from "./upstreamEnvironment";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("what the hourly check asks", () => {
  it("asks every chain endpoint and every subgraph configured, Unichain's among them, and none that is not", () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "key");
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
    vi.stubEnv("UNICHAIN_RPC_URL", "https://unichain.example");
    vi.stubEnv("UNISWAP_V4_UNICHAIN_SUBGRAPH_ID", "unichain-v4");
    vi.stubEnv("BASE_RPC_URL", "");
    vi.stubEnv("ARBITRUM_RPC_URL", "");
    vi.stubEnv("UNISWAP_V3_BASE_SUBGRAPH_ID", "");
    vi.stubEnv("UNISWAP_V3_ARBITRUM_SUBGRAPH_ID", "");
    vi.stubEnv("UNISWAP_V4_ETHEREUM_SUBGRAPH_ID", "");
    vi.stubEnv("UNISWAP_V4_BASE_SUBGRAPH_ID", "");
    vi.stubEnv("UNISWAP_V4_ARBITRUM_SUBGRAPH_ID", "");

    const probes = upstreamProbes();

    expect(Object.keys(probes?.probeOtherChains ?? {})).toEqual(["unichain"]);
    expect(Object.keys(probes?.probeSubgraphs ?? {}).sort()).toEqual(["v3-ethereum", "v4-unichain"]);
  });

  it("asks nothing when the key or mainnet's settings are missing", () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "");

    expect(upstreamProbes()).toBeNull();
  });
});
