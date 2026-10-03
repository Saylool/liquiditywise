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
  it("are Ethereum, Base, Arbitrum One, Unichain, OP Mainnet and Polygon, by their own ids", () => {
    expect(CHAINS.map(({ id, slug }) => [id, slug])).toEqual([
      [1, "ethereum"],
      [8453, "base"],
      [42161, "arbitrum"],
      [130, "unichain"],
      [10, "optimism"],
      [137, "polygon"],
    ]);
    expect(isSupportedChainId(56)).toBe(false);
  });

  it("each name their own currency: ether everywhere but Polygon, where it is POL", () => {
    expect(CHAINS.map(({ slug, native }) => [slug, native])).toEqual([
      ["ethereum", "ETH"],
      ["base", "ETH"],
      ["arbitrum", "ETH"],
      ["unichain", "ETH"],
      ["optimism", "ETH"],
      ["polygon", "POL"],
    ]);
    expect(nativeSymbolOf(137)).toBe("POL");
    expect(nativeSymbolOf(10)).toBe("ETH");
    expect(nativeSymbolOf(56)).toBe("ETH");
  });

  it("are found by slug, and nothing else is read as one", () => {
    expect(chainBySlug("base")?.id).toBe(8453);
    expect(chainBySlug("Base")).toBeNull();
    expect(chainBySlug("optimism")?.id).toBe(10);
    expect(chainBySlug("polygon")?.id).toBe(137);
    expect(chainBySlug("bnb")).toBeNull();
    expect(chainOf(42161).slug).toBe("arbitrum");
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
  it("are every chain", () => {
    expect(V4_CHAINS.map(({ slug }) => slug)).toEqual(["ethereum", "base", "arbitrum", "unichain", "optimism", "polygon"]);
    expect([readsV4(1), readsV4(8453), readsV4(42161), readsV4(130), readsV4(10), readsV4(137)]).toEqual([
      true, true, true, true, true, true,
    ]);
  });

  it("read v3 everywhere but Unichain, where no v3 source answers", () => {
    expect(V3_CHAINS.map(({ slug }) => slug)).toEqual(["ethereum", "base", "arbitrum", "optimism", "polygon"]);
    expect([readsV3(1), readsV3(130)]).toEqual([true, false]);
    expect(poolIdentityFor("v3", POOL, 130)).toBeNull();
    expect(poolIdentityFor("v4", `0x${"e5".repeat(32)}`, 130)?.chainId).toBe(130);
  });
});

describe("the chains positions can be listed on", () => {
  it("are mainnet, Base, Arbitrum One, OP Mainnet and Polygon, which have a source that keeps positions, and no other", () => {
    expect(V3_POSITION_CHAINS.map(({ slug }) => slug)).toEqual(["ethereum", "base", "arbitrum", "optimism", "polygon"]);
    expect([1, 8453, 10, 137, 42161, 130].map((id) => readsV3Positions(id as 1))).toEqual([true, true, true, true, true, false]);
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
  });
});
