import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getSmartLiquidityCopy } from "./smartLiquidityCopy";

describe("the smart-money page's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getSmartLiquidityCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getSmartLiquidityCopy(locale);
      for (const key of [
        "link",
        "title",
        "description",
        "heading",
        "pairsHeading",
        "value",
        "range",
        "ownRange",
        "medianYield",
        "topHeading",
        "owner",
        "ownerPositions",
        "unavailable",
        "empty",
        "loading",
      ] as const) {
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
      }
    }
  });

  it("define smart by what it measures, state both floors and the share, and say it is no recommendation, in every language", () => {
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
      const method = getSmartLiquidityCopy(locale).method("$10,000", "3", "20%");
      expect(method, locale).toContain("$10,000");
      expect(method, locale).toContain("3");
      expect(method, locale).toContain("20%");
      expect(method, locale).toContain(NOT_A_RECOMMENDATION[locale]);
    }
  });

  it("put every figure it is given into its sentences, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getSmartLiquidityCopy(locale);
      const summary = copy.summary("506", "95", "34%", "10%");
      for (const figure of ["506", "95", "34%", "10%"]) expect(summary, `${locale} summary`).toContain(figure);
      for (const [line, figures] of [
        [copy.intro("Polygon", "12"), ["Polygon", "12"]],
        [copy.titleOn("Polygon"), ["Polygon"]],
        [copy.poolsRead("11", "12"), ["11", "12"]],
        [copy.positions("7"), ["7"]],
        [copy.rangeValue("-3%", "+4%"), ["-3%", "+4%"]],
        [copy.earned("$508", "9"), ["$508", "9"]],
        [copy.measuredAt("2026-09-30 12:00"), ["2026-09-30 12:00"]],
        [copy.notRead("Base", "Ethereum, Polygon"), ["Base", "Ethereum, Polygon"]],
      ] as const) {
        for (const figure of figures) expect(line, locale).toContain(figure);
      }
    }
  });
});
