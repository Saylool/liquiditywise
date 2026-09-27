import { describe, expect, it } from "vitest";

import { getChainCopy, titleOnChain } from "./chainCopy";
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
    expect(titleOnChain("Uniswap v4 kancaları · LiquidityWise", "Base")).toBe("Uniswap v4 kancaları · Base · LiquidityWise");
    expect(titleOnChain("Hooks", "Arbitrum One")).toBe("Hooks · Arbitrum One");
  });
});
