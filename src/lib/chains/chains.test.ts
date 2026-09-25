import { describe, expect, it } from "vitest";

import { poolAnalysisHref, readRequestedChain } from "../advisor/requestedParameters";
import { chainLabel } from "./chainLabel";
import { chainBySlug, chainOf, CHAINS, ETHEREUM, isSupportedChainId } from "./chains";
import { poolName } from "../usage/usageLines";
import { poolIdentityFor } from "../uniswap/subgraphPoolIdentity";

const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const PARAMETERS = { horizonDays: 30, standardDeviationMultiplier: 1 } as const;

describe("the chains", () => {
  it("are Ethereum, Base and Arbitrum One, by their own ids", () => {
    expect(CHAINS.map(({ id, slug }) => [id, slug])).toEqual([
      [1, "ethereum"],
      [8453, "base"],
      [42161, "arbitrum"],
    ]);
    expect(isSupportedChainId(10)).toBe(false);
  });

  it("are found by slug, and nothing else is read as one", () => {
    expect(chainBySlug("base")?.id).toBe(8453);
    expect(chainBySlug("Base")).toBeNull();
    expect(chainBySlug("optimism")).toBeNull();
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

describe("a pool's name in the journal", () => {
  it("keeps mainnet's form and marks every other chain", () => {
    expect(poolName("v3", POOL)).toBe(`v3:${POOL}`);
    expect(poolName("v3", POOL, 42161)).toBe(`v3@arbitrum:${POOL}`);
  });
});

describe("a pool id asked about on a chain", () => {
  it("takes a v3 address on any chain read", () => {
    expect(poolIdentityFor("v3", POOL, 8453)?.chainId).toBe(8453);
  });

  it("refuses a v4 id off mainnet rather than looking it up there", () => {
    expect(poolIdentityFor("v4", `0x${"e5".repeat(32)}`, 8453)).toBeNull();
    expect(poolIdentityFor("v4", `0x${"e5".repeat(32)}`)?.chainId).toBe(1);
  });
});

describe("a chain's name on the page", () => {
  it("is the interface's own words for mainnet, and the chain's name elsewhere", () => {
    expect(chainLabel(1, "tr")).toBe("Ethereum ana ağı");
    expect(chainLabel(8453, "tr")).toBe("Base");
    expect(chainLabel(42161, "de")).toBe("Arbitrum One");
  });
});
