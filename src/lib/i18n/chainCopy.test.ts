import { describe, expect, it } from "vitest";

import { CHAINS, chainOf } from "../chains/chains";
import { getChainCopy, titleOnChain } from "./chainCopy";
import { getPositionOutlookCopy } from "./positionOutlookCopy";
import { LOCALES } from "./locales";

describe("the words the chain choice needs", () => {
  it("name, in every language, the chain whose v4 pools are not read", () => {
    for (const locale of LOCALES) {
      const line = getChainCopy(locale).v4NotRead("Optimism");
      expect(line, locale).toContain("Optimism");
      expect(line, locale).toContain("v4");
    }
  });
});

describe("a page's title on a chain", () => {
  it("names the chain before the site's name, and after a title that has none", () => {
    expect(titleOnChain("Uniswap v4 hook'ları · LiquidityWise", "Base")).toBe("Uniswap v4 hook'ları · Base · LiquidityWise");
    expect(titleOnChain("Hooks", "Arbitrum One")).toBe("Hooks · Arbitrum One");
  });
});

describe("a chain whose v3 pools are not read", () => {
  it("is named, in every language, with v4 read and v3 not", () => {
    for (const locale of LOCALES) {
      const line = getChainCopy(locale).v3NotRead("Unichain");
      expect(line, locale).toContain("Unichain");
      expect(line, locale).toContain("v3");
      expect(line, locale).toContain("v4");
    }
  });

  it("is among the chains the unknown-chain line names, in every language", () => {
    for (const locale of LOCALES) expect(getChainCopy(locale).unknown, locale).toContain("Unichain");
  });
});

describe("the chains the unknown-chain line names", () => {
  it("are every chain read, BNB Chain, Avalanche and Celo among them, in every language", () => {
    for (const locale of LOCALES) {
      for (const { name } of CHAINS) expect(getChainCopy(locale).unknown, `${locale} ${name}`).toContain(name);
    }
  });

  it("name Celo, read for v3 alone, as a chain whose v4 pools are not read, in every language", () => {
    for (const locale of LOCALES) {
      const line = getChainCopy(locale).v4NotRead(chainOf(42220).name);
      expect(line, locale).toContain("Celo");
      expect(line, locale).toContain("v4");
    }
  });
});

describe("the words under a position", () => {
  it("carry every count and the range, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getPositionOutlookCopy(locale);
      const line = copy.days("30", "11", "22", "33");
      for (const count of ["30", "11", "22", "33"]) expect(line, locale).toContain(count);
      expect(copy.suggested("RANGE"), locale).toContain("RANGE");
      if (locale !== "en") expect(line, locale).not.toBe(getPositionOutlookCopy("en").days("30", "11", "22", "33"));
    }
  });
});
