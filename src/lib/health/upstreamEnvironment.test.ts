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

  it("asks the two positions subgraphs under their own names, and the pool pages' Base and OP Mainnet ones apart from them", async () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "key");
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
    vi.stubEnv("UNISWAP_V3_BASE_SUBGRAPH_ID", "base-v3");
    vi.stubEnv("UNISWAP_V3_BASE_POSITIONS_SUBGRAPH_ID", "base-positions");
    vi.stubEnv("UNISWAP_V3_OPTIMISM_POSITIONS_SUBGRAPH_ID", "optimism-positions");
    const asked: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (asked.push(url), new Response("{}", { status: 200 }))));

    const probes = upstreamProbes();
    await probes?.probeSubgraphs?.["v3-base"]?.();
    await probes?.probeSubgraphs?.["v3-base-positions"]?.();
    await probes?.probeSubgraphs?.["v3-optimism-positions"]?.();
    vi.unstubAllGlobals();

    expect(asked.map((url) => url.split("/").pop())).toEqual(["base-v3", "base-positions", "optimism-positions"]);
  });

  it("asks BNB Chain's, Avalanche's and Celo's own endpoints and subgraphs, each under its own name, and Celo's for v3 alone", async () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "key");
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
    vi.stubEnv("BNB_RPC_URL", "https://bnb.example");
    vi.stubEnv("AVALANCHE_RPC_URL", "https://avalanche.example");
    vi.stubEnv("CELO_RPC_URL", "https://celo.example");
    vi.stubEnv("UNISWAP_V3_BNB_SUBGRAPH_ID", "bnb-v3");
    vi.stubEnv("UNISWAP_V4_BNB_SUBGRAPH_ID", "bnb-v4");
    vi.stubEnv("UNISWAP_V3_AVALANCHE_SUBGRAPH_ID", "avalanche-v3");
    vi.stubEnv("UNISWAP_V4_AVALANCHE_SUBGRAPH_ID", "avalanche-v4");
    vi.stubEnv("UNISWAP_V3_CELO_SUBGRAPH_ID", "celo-v3");
    vi.stubEnv("UNISWAP_V4_CELO_SUBGRAPH_ID", "celo-v4");
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        asked.push(url);
        return new Response("{}", { status: 200 });
      }),
    );

    const probes = upstreamProbes();
    for (const name of ["v3-bnb", "v4-bnb", "v3-avalanche", "v4-avalanche", "v3-celo"] as const) {
      await probes?.probeSubgraphs?.[name]?.();
    }
    await probes?.probeOtherChains?.bnb?.();
    await probes?.probeOtherChains?.avalanche?.();
    await probes?.probeOtherChains?.celo?.();
    vi.unstubAllGlobals();

    expect(asked.map((url) => url.split("/").pop())).toEqual([
      "bnb-v3",
      "bnb-v4",
      "avalanche-v3",
      "avalanche-v4",
      "celo-v3",
      "bnb.example",
      "avalanche.example",
      "celo.example",
    ]);
    /* No v4 subgraph is read on Celo, so none is asked about there, whatever the environment holds. */
    expect(Object.keys(probes?.probeSubgraphs ?? {})).not.toContain("v4-celo");
  });

  it("asks nothing when the key or mainnet's settings are missing", () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "");

    expect(upstreamProbes()).toBeNull();
  });

  /* Keyless, so asked wherever the rest is: each about Uniswap's own PoolManager, on that network. */
  it("asks Sourcify and every network's Blockscout about the PoolManager each is known to hold verified", async () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "key");
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        asked.push(url);
        return new Response(JSON.stringify({ match: "match", is_verified: true, name: "PoolManager" }), { status: 200 });
      }),
    );

    const probes = upstreamProbes();
    const verdicts = await Promise.all(Object.values(probes?.probeVerifiers ?? {}).map((probe) => probe()));
    vi.unstubAllGlobals();

    expect(Object.keys(probes?.probeVerifiers ?? {})).toHaveLength(7);
    expect(verdicts.every(({ kind }) => kind === "verified")).toBe(true);
    expect(asked.sort()).toEqual(
      [
        "https://sourcify.dev/server/v2/contract/1/0x000000000004444c5dc75cb358380d2e3de08a90?fields=compilation.name",
        "https://eth.blockscout.com/api/v2/addresses/0x000000000004444c5dc75cb358380d2e3de08a90",
        "https://base.blockscout.com/api/v2/addresses/0x498581ff718922c3f8e6a244956af099b2652b2b",
        "https://arbitrum.blockscout.com/api/v2/addresses/0x360e68faccca8ca495c1b759fd9eee466db9fb32",
        "https://unichain.blockscout.com/api/v2/addresses/0x1f98400000000000000000000000000000000004",
        "https://explorer.optimism.io/api/v2/addresses/0x9a13f98cb987694c9f086b1f5eb990eea8264ec3",
        "https://polygon.blockscout.com/api/v2/addresses/0x67366782805870060151383f4bbff9dab53e5cd6",
      ].sort(),
    );
    /* BNB Chain and Avalanche have no Blockscout, and nothing stands in for one. */
    expect(asked.some((url) => /bnb|bsc|avalanche|avax|snowtrace/.test(url))).toBe(false);
  });
});

describe("the e-mail provider", () => {
  const base = () => {
    vi.stubEnv("THE_GRAPH_API_KEY", "key");
    vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
    vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
  };

  it("is asked about its key only where the digest by e-mail is set up, and answers a status alone", async () => {
    base();
    vi.stubEnv("RESEND_API_KEY", "re_key");
    vi.stubEnv("EMAIL_FROM", "LiquidityWise <digest@liquiditywise.com>");
    vi.stubEnv("EMAIL_DIGEST_SECRET", "secret");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379/1");
    const asked: { url: string; auth: string | undefined }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        asked.push({ url, auth: (init.headers as Record<string, string>).Authorization });
        return new Response("[]", { status: 403 });
      }),
    );

    const status = await upstreamProbes()?.probeEmailProvider?.();
    vi.unstubAllGlobals();

    expect(status).toBe(403);
    expect(asked).toEqual([{ url: "https://api.resend.com/domains", auth: "Bearer re_key" }]);
  });

  it("is not asked where any of the three settings is missing", () => {
    base();
    vi.stubEnv("RESEND_API_KEY", "re_key");
    vi.stubEnv("EMAIL_FROM", "digest@liquiditywise.com");
    vi.stubEnv("EMAIL_DIGEST_SECRET", "");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379/1");

    expect(upstreamProbes()?.probeEmailProvider).toBeUndefined();
  });
});
