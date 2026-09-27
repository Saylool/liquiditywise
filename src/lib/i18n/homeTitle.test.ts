import { describe, expect, it } from "vitest";

import { getDictionary } from "./dictionaries";
import { getInterfaceCopy } from "./interface";
import { LOCALES } from "./locales";

describe("the front page's title", () => {
  it("says, in every language, what the site is for — not the name alone", () => {
    for (const locale of LOCALES) {
      const title = getInterfaceCopy(locale).homeTitle;
      expect(title, locale).toMatch(/^LiquidityWise — /);
      expect(title, locale).toContain("Uniswap");
      expect(title, locale).toMatch(/v3/);
      expect(title, locale).toMatch(/v4/);
      if (locale !== "en") expect(title, locale).not.toBe(getInterfaceCopy("en").homeTitle);
    }
  });
});

describe("the pool page's description", () => {
  it("names no single chain, now that pools are read on four", () => {
    for (const locale of LOCALES) {
      expect(getDictionary(locale).metadata.poolDescription, locale).not.toMatch(/mainnet|Mainnet|主网|主網|ana ağ|principal|основной|मेननेट|الرئيسية/);
    }
  });
});
