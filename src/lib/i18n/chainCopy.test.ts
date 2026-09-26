import { describe, expect, it } from "vitest";

import { getChainCopy } from "./chainCopy";
import { LOCALES } from "./locales";

describe("the words the chain choice needs", () => {
  it("name, in every language, the chain whose v4 pools are not read, and the two that are", () => {
    for (const locale of LOCALES) {
      const line = getChainCopy(locale).v4NotRead("Base");
      expect(line, locale).toContain("Base");
      expect(line, locale).toContain("Arbitrum One");
      expect(line, locale).toContain("v4");
    }
  });
});
