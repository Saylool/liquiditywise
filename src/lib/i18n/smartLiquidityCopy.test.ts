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
        [copy.alongside("-5% … +3%", "-2% … +2%", "7"), ["-5% … +3%", "-2% … +2%", "7"]],
      ] as const) {
        for (const figure of figures) expect(line, locale).toContain(figure);
      }
    }
  });

  it("carries the trend and holder words in every language, none left in English or empty", () => {
    const english = getSmartLiquidityCopy("en");
    const words = (locale: (typeof LOCALES)[number]) => {
      const { trend, holders } = getSmartLiquidityCopy(locale);
      return {
        trendIntro: trend.intro,
        trendNotYet: trend.notYet,
        gaining: trend.gaining,
        losing: trend.losing,
        holdersHeading: holders.heading,
        holdersNotYet: holders.notYet,
        wallet: holders.wallet,
        contract: holders.contract,
        contractNote: holders.contractNote,
        gone: holders.gone,
        kept: holders.kept,
      };
    };

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      for (const [key, value] of Object.entries(words(locale))) {
        expect(value.trim(), `${locale} ${key}`).not.toBe("");
        /* German writes "Wallet" as English does; every other word is its own. */
        if (!(locale === "de" && key === "wallet")) expect(value, `${locale} ${key}`).not.toBe(words("en")[key as keyof ReturnType<typeof words>]);
      }
    }
    expect(english.trend.heading("7")).toContain("7");
  });

  it("put every figure into the trend and holder sentences, in every language", () => {
    for (const locale of LOCALES) {
      const { trend, holders } = getSmartLiquidityCopy(locale);
      for (const [line, figures] of [
        [trend.heading("6"), ["6"]],
        [trend.range("-5%", "+7%"), ["-5%", "+7%"]],
        [trend.rangeNew("+7%"), ["+7%"]],
        [trend.share("20%", "31%"), ["20%", "31%"]],
        [trend.shareNew("10%"), ["10%"]],
        [trend.widthLabel("16%", "8%"), ["16%", "8%"]],
        [trend.mover("USDC / WETH", "20%", "31%"), ["USDC / WETH", "20%", "31%"]],
        [holders.intro("28"), ["28"]],
        [holders.seen("27", "28"), ["27", "28"]],
        [holders.now("3", "$50,000"), ["3", "$50,000"]],
      ] as const) {
        for (const figure of figures) expect(line, locale).toContain(figure);
      }
    }
  });

  it("points from then to now in every language — right, since figures in Latin digits lay out left to right in Arabic too", () => {
    for (const locale of LOCALES) {
      const { trend } = getSmartLiquidityCopy(locale);
      expect(trend.range("-5%", "+7%"), locale).toMatch(/-5% → \+7%/);
      expect(trend.share("20%", "31%"), locale).toContain("20% → 31%");
      expect(trend.mover("USDC / WETH", "20%", "31%"), locale).toContain("20% → 31%");
    }
  });

  it("says, in every language, that nothing is kept about who reads the page", () => {
    for (const locale of LOCALES) expect(getSmartLiquidityCopy(locale).holders.kept.length, locale).toBeGreaterThan(40);
  });
});
