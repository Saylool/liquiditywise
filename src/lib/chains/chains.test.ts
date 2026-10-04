import { describe, expect, it } from "vitest";

import { poolAnalysisHref, readRequestedChain, v4PoolAnalysisHref } from "../advisor/requestedParameters";
import { chainLabel } from "./chainLabel";
import {
  chainBySlug,
  chainOf,
  CHAINS,
  ETHEREUM,
  isSupportedChainId,
  nativeSymbolOf,
  readsV3,
  readsV3Positions,
  readsV4,
  V3_CHAINS,
  V3_POSITION_CHAINS,
  V4_CHAINS,
} from "./chains";
import { poolName } from "../usage/usageLines";
import { poolIdentityFor } from "../uniswap/subgraphPoolIdentity";

const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const PARAMETERS = { horizonDays: 30, standardDeviationMultiplier: 1 } as const;

describe("the chains", () => {
  it("are Ethereum, Base, Arbitrum One, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche and Celo, by their own ids", () => {
    expect(CHAINS.map(({ id, slug, name }) => [id, slug, name])).toEqual([
      [1, "ethereum", "Ethereum"],
      [8453, "base", "Base"],
      [42161, "arbitrum", "Arbitrum One"],
      [130, "unichain", "Unichain"],
      [10, "optimism", "OP Mainnet"],
      [137, "polygon", "Polygon"],
      [56, "bnb", "BNB Chain"],
      [43114, "avalanche", "Avalanche"],
      [42220, "celo", "Celo"],
    ]);
    expect(isSupportedChainId(324)).toBe(false);
  });

  it("each name their own currency: ether on Ethereum and the rollups, and each other chain its own", () => {
    expect(CHAINS.map(({ slug, native }) => [slug, native])).toEqual([
      ["ethereum", "ETH"],
      ["base", "ETH"],
      ["arbitrum", "ETH"],
      ["unichain", "ETH"],
      ["optimism", "ETH"],
      ["polygon", "POL"],
      ["bnb", "BNB"],
      ["avalanche", "AVAX"],
      ["celo", "CELO"],
    ]);
    expect(nativeSymbolOf(137)).toBe("POL");
    expect(nativeSymbolOf(10)).toBe("ETH");
    expect([nativeSymbolOf(56), nativeSymbolOf(43114), nativeSymbolOf(42220)]).toEqual(["BNB", "AVAX", "CELO"]);
    expect(nativeSymbolOf(324)).toBe("ETH");
  });

  it("are found by slug, and nothing else is read as one", () => {
    expect(chainBySlug("base")?.id).toBe(8453);
    expect(chainBySlug("Base")).toBeNull();
    expect(chainBySlug("optimism")?.id).toBe(10);
    expect(chainBySlug("polygon")?.id).toBe(137);
    expect([chainBySlug("bnb")?.id, chainBySlug("avalanche")?.id, chainBySlug("celo")?.id]).toEqual([56, 43114, 42220]);
    expect(chainBySlug("bsc")).toBeNull();
    expect(chainBySlug("zksync")).toBeNull();
    expect(chainOf(42161).slug).toBe("arbitrum");
  });

  /*
   * Measured on 2026-10-04 (chains.ts): every one answered its search and
   * pair queries in seconds, so none is read from the day table the way
   * Base's and Polygon's v3 are.
   */
  it("search and list pairs on BNB Chain, Avalanche and Celo from their own pools, not the day table", () => {
    for (const id of [56, 43114, 42220]) {
      const chain = chainOf(id);
      expect([chain.v3Search, chain.v3Pairs], chain.slug).toEqual(["pools", "pools"]);
    }
    expect([chainOf(56).v4Pairs, chainOf(43114).v4Pairs]).toEqual(["pools", "pools"]);
  });
});

describe("the chain a request names", () => {
  it("is mainnet when it names none", () => {
    expect(readRequestedChain(undefined)).toBe(ETHEREUM);
  });

  it("is the chain a slug names", () => {
    expect(readRequestedChain("arbitrum")?.id).toBe(42161);
    expect(readRequestedChain("ethereum")).toBe(ETHEREUM);
  });

  it("is refused, not read as mainnet, when unknown or repeated", () => {
    expect(readRequestedChain("solana")).toBeNull();
    expect(readRequestedChain(["base", "base"])).toBeNull();
    expect(readRequestedChain("")).toBeNull();
  });
});

describe("a link to a pool's analysis", () => {
  it("says nothing about the chain on mainnet, so every older link reads the same", () => {
    expect(poolAnalysisHref(POOL, PARAMETERS)).toBe(`/pool?address=${POOL}&days=30&sigma=1`);
  });

  it("carries the chain everywhere else", () => {
    expect(poolAnalysisHref(POOL, PARAMETERS, undefined, chainOf(8453))).toBe(
      `/pool?chain=base&address=${POOL}&days=30&sigma=1`,
    );
  });
});

describe("the chains v4 is read on", () => {
  it("are every chain but Celo", () => {
    expect(V4_CHAINS.map(({ slug }) => slug)).toEqual([
      "ethereum",
      "base",
      "arbitrum",
      "unichain",
      "optimism",
      "polygon",
      "bnb",
      "avalanche",
    ]);
    expect([1, 8453, 42161, 130, 10, 137, 56, 43114, 42220].map((id) => readsV4(id as 1))).toEqual([
      true, true, true, true, true, true, true, true, false,
    ]);
  });

  it("refuse a v4 pool on Celo, where v3 alone is read, rather than look for it elsewhere", () => {
    expect(poolIdentityFor("v4", `0x${"e5".repeat(32)}`, 42220)).toBeNull();
    expect(poolIdentityFor("v3", POOL, 42220)?.chainId).toBe(42220);
  });

  it("read v3 everywhere but Unichain, where no v3 source answers", () => {
    expect(V3_CHAINS.map(({ slug }) => slug)).toEqual([
      "ethereum",
      "base",
      "arbitrum",
      "optimism",
      "polygon",
      "bnb",
      "avalanche",
      "celo",
    ]);
    expect([readsV3(1), readsV3(130), readsV3(42220)]).toEqual([true, false, true]);
    expect(poolIdentityFor("v3", POOL, 130)).toBeNull();
    expect(poolIdentityFor("v4", `0x${"e5".repeat(32)}`, 130)?.chainId).toBe(130);
  });
});

describe("the chains positions can be listed on", () => {
  it("are mainnet, Base, Arbitrum One, OP Mainnet and Polygon, which have a source that keeps positions, and no other", () => {
    expect(V3_POSITION_CHAINS.map(({ slug }) => slug)).toEqual(["ethereum", "base", "arbitrum", "optimism", "polygon"]);
    expect([1, 8453, 10, 137, 42161, 130].map((id) => readsV3Positions(id as 1))).toEqual([true, true, true, true, true, false]);
    /* None of BNB Chain's, Avalanche's or Celo's v3 subgraphs has a Position entity (measured 2026-10-04). */
    expect([56, 43114, 42220].map((id) => readsV3Positions(id as 1))).toEqual([false, false, false]);
  });
});

describe("a link to a v4 pool's analysis", () => {
  const ID = `0x${"e5".repeat(32)}`;

  it("says nothing about the chain on mainnet, and carries it elsewhere", () => {
    expect(v4PoolAnalysisHref(ID, PARAMETERS)).toBe(`/v4?id=${ID}&days=30&sigma=1`);
    expect(v4PoolAnalysisHref(ID, PARAMETERS, 2500, chainOf(42161))).toBe(
      `/v4?chain=arbitrum&id=${ID}&days=30&sigma=1&usd=2500`,
    );
  });
});

describe("a pool's name in the journal", () => {
  it("keeps mainnet's form and marks every other chain", () => {
    expect(poolName("v3", POOL)).toBe(`v3:${POOL}`);
    expect(poolName("v3", POOL, 42161)).toBe(`v3@arbitrum:${POOL}`);
    expect(poolName("v4", `0x${"e5".repeat(32)}`, 42161)).toBe(`v4@arbitrum:0x${"e5".repeat(32)}`);
  });
});

describe("a pool id asked about on a chain", () => {
  it("takes a v3 address on any chain read", () => {
    expect(poolIdentityFor("v3", POOL, 8453)?.chainId).toBe(8453);
  });

  it("takes a v4 id on the chain it was asked about, and mainnet when not said", () => {
    expect(poolIdentityFor("v4", `0x${"e5".repeat(32)}`)?.chainId).toBe(1);
    expect(poolIdentityFor("v4", `0x${"e5".repeat(32)}`, 8453)?.chainId).toBe(8453);
    expect(poolIdentityFor("v4", `0x${"e5".repeat(32)}`, 42161)?.chainId).toBe(42161);
  });
});

describe("a chain's name on the page", () => {
  it("is the interface's own words for mainnet, and the chain's name elsewhere", () => {
    expect(chainLabel(1, "tr")).toBe("Ethereum ana ağı");
    expect(chainLabel(8453, "tr")).toBe("Base");
    expect(chainLabel(42161, "de")).toBe("Arbitrum One");
    expect([chainLabel(56, "ar"), chainLabel(43114, "zh"), chainLabel(42220, "hi")]).toEqual(["BNB Chain", "Avalanche", "Celo"]);
  });
});
