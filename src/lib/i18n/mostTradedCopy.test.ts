import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getMostTradedCopy } from "./mostTradedCopy";

describe("the most-traded page's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getMostTradedCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getMostTradedCopy(locale);
      for (const key of ["link", "title", "description", "heading", "intro", "volume", "fees", "unavailable", "empty", "loading"] as const) {
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

    for (const locale of LOCALES) expect(getMostTradedCopy(locale).intro, locale).toContain(NOT_A_RECOMMENDATION[locale]);
  });
});
