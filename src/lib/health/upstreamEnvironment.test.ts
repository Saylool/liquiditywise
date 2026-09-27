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

  it("asks OP Mainnet's and Polygon's own endpoints and subgraphs, each under its own name", async () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "key");
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
    vi.stubEnv("OPTIMISM_RPC_URL", "https://optimism.example");
    vi.stubEnv("POLYGON_RPC_URL", "https://polygon.example");
    vi.stubEnv("UNISWAP_V3_OPTIMISM_SUBGRAPH_ID", "optimism-v3");
    vi.stubEnv("UNISWAP_V4_OPTIMISM_SUBGRAPH_ID", "optimism-v4");
    vi.stubEnv("UNISWAP_V3_POLYGON_SUBGRAPH_ID", "polygon-v3");
    vi.stubEnv("UNISWAP_V4_POLYGON_SUBGRAPH_ID", "polygon-v4");
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        asked.push(url);
        return new Response("{}", { status: 200 });
      }),
    );

    const probes = upstreamProbes();
    for (const name of ["v3-optimism", "v4-optimism", "v3-polygon", "v4-polygon"] as const) {
      await probes?.probeSubgraphs?.[name]?.();
    }
    await probes?.probeOtherChains?.optimism?.();
    await probes?.probeOtherChains?.polygon?.();
    vi.unstubAllGlobals();

    expect(asked.map((url) => url.split("/").pop())).toEqual([
      "optimism-v3",
      "optimism-v4",
      "polygon-v3",
      "polygon-v4",
      "optimism.example",
      "polygon.example",
    ]);
  });

  it("asks nothing when the key or mainnet's settings are missing", () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "");

    expect(upstreamProbes()).toBeNull();
  });
});
