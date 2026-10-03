import { describe, expect, it } from "vitest";

import { getEmbedCopy } from "./embedCopy";
import { LOCALES } from "./locales";

describe("the embeddable card's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getEmbedCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getEmbedCopy(locale);
      for (const key of [
        "notAdvice",
        "analysedBy",
        "newTab",
        "unreadable",
        "notAPool",
        "summary",
        "intro",
        "codeLabel",
        "data",
      ] as const) {
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
      }
      expect(copy.disclaimer("30"), locale).not.toBe(english.disclaimer("30"));
      expect(copy.frameTitle("USDC / WETH"), locale).not.toBe(english.frameTitle("USDC / WETH"));
    }
  });

  /* The site's name is not translated, and the link back says whose figures these are. */
  it("name the site, and put every figure they are given into their sentences", () => {
    for (const locale of LOCALES) {
      const copy = getEmbedCopy(locale);
      expect(copy.analysedBy, locale).toContain("LiquidityWise");
      expect(copy.frameTitle("USDC / WETH"), locale).toContain("USDC / WETH");
      expect(copy.disclaimer("30"), locale).toContain("30");
      expect(copy.drawnFor("30 X", "1σ"), locale).toContain("30 X");
      expect(copy.drawnFor("30 X", "1σ"), locale).toContain("1σ");
    }
  });

  it("say it is not advice and not a recommendation, in every language", () => {
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
      const copy = getEmbedCopy(locale);
      expect(copy.disclaimer("30"), locale).toContain(NOT_A_RECOMMENDATION[locale]);
      expect(copy.disclaimer("30"), locale).toContain(copy.notAdvice.replace(/[.。।]$/u, "").toLowerCase().slice(-8));
    }
  });
});
