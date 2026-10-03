import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getPairPoolsCopy } from "./pairPoolsCopy";

describe("the pair page's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getPairPoolsCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getPairPoolsCopy(locale);
      for (const key of [
        "link",
        "title",
        "description",
        "heading",
        "network",
        "label",
        "submit",
        "notAPair",
        "apart",
        "symbols",
        "window",
        "feeYield",
        "ranked",
        "unranked",
        "hook",
        "quiet",
        "weekUnread",
        "liquidityUnread",
        "chainsHeading",
        "none",
        "loading",
      ] as const) {
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
      }
      expect(copy.method("$1"), locale).not.toBe(english.method("$1"));
      expect(copy.intro("X"), locale).not.toBe(english.intro("X"));
      expect(copy.resultsFor("X"), locale).not.toBe(english.resultsFor("X"));
      expect(copy.thin("$1"), locale).not.toBe(english.thin("$1"));
    }
  });

  it("state the floor, and say the yield is past fees and no recommendation, in every language", () => {
    const NOT_A_RECOMMENDATION: Record<(typeof LOCALES)[number], string> = {
      en: "recommendation",
      tr: "öneri",
      de: "Empfehlung",
      es: "recomendación",
      ar: "توصية",
      hi: "सिफ़ारिश",
      zh: "推荐",
      ru: "рекомендац",
      pt: "recomendação",
      "zh-Hant": "推薦",
    };

    for (const locale of LOCALES) {
      const copy = getPairPoolsCopy(locale);
      const method = copy.method("$100,000");
      expect(method, locale).toContain("$100,000");
      expect(method, locale).toContain(NOT_A_RECOMMENDATION[locale]);
      expect(copy.thin("$100,000"), locale).toContain("$100,000");
    }
  });

  it("put every figure it is given into its sentences, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getPairPoolsCopy(locale);
      expect(copy.intro("Ethereum, Base"), locale).toContain("Ethereum, Base");
      expect(copy.resultsFor("USDC / WETH"), locale).toContain("USDC / WETH");
      expect(copy.titleFor("USDC/WETH"), locale).toContain("USDC/WETH");
      expect(copy.chainRead("Base", "3"), locale).toContain("Base");
      expect(copy.chainRead("Base", "3"), locale).toContain("3");
      expect(copy.chainUnread("Polygon"), locale).toContain("Polygon");
    }
  });
});
