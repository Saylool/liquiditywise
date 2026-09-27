import { describe, expect, it } from "vitest";

import { getChainCopy } from "./chainCopy";
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
