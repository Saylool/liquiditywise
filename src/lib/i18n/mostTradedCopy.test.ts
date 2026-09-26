import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getMostTradedCopy } from "./mostTradedCopy";

describe("the most-traded page's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getMostTradedCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getMostTradedCopy(locale);
      for (const key of ["link", "title", "description", "heading", "volume", "fees", "unavailable", "empty", "loading"] as const) {
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
      }
    }
  });

  it("put both numbers into the day count, in every language", () => {
    for (const locale of LOCALES) {
      const line = getMostTradedCopy(locale).days("5", "7");
      expect(line, locale).toContain("5");
      expect(line, locale).toContain("7");
    }
  });

  it("say, in every language, that the order is not a recommendation", () => {
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

    for (const locale of LOCALES) expect(getMostTradedCopy(locale).intro("Base"), locale).toContain(NOT_A_RECOMMENDATION[locale]);
  });
});

describe("the most-traded page on a chain", () => {
  it("names the chain in its introduction, title and description, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getMostTradedCopy(locale);
      for (const line of [copy.intro("Arbitrum One"), copy.titleOn("Arbitrum One", true), copy.descriptionOn("Arbitrum One", true)]) {
        expect(line, locale).toContain("Arbitrum One");
      }
      expect(copy.intro("Ethereum"), locale).not.toContain("Arbitrum");
    }
  });

  it("says v3 alone on a chain where no v4 is listed", () => {
    for (const locale of LOCALES) {
      const copy = getMostTradedCopy(locale);
      expect(copy.titleOn("Base", false), locale).toContain("v3");
      expect(copy.titleOn("Base", false), locale).not.toContain("v4");
      expect(copy.descriptionOn("Base", false), locale).not.toContain("v4");
    }
  });

  it("names v3 and v4 on a chain where both are listed", () => {
    for (const locale of LOCALES) {
      const copy = getMostTradedCopy(locale);
      for (const line of [copy.titleOn("Arbitrum One", true), copy.descriptionOn("Arbitrum One", true)]) {
        expect(line, locale).toContain("v3");
        expect(line, locale).toContain("v4");
      }
    }
  });
});
