import { describe, expect, it } from "vitest";

import { type CasesCopy, getCasesCopy } from "./casesCopy";
import { LOCALES } from "./locales";

/*
 * The cases page's words, in every language. A label left in English, a
 * figure dropped from a sentence, or a language that forgot to say the
 * whole thing is a measurement of the past would each leave its reader with
 * less than the English one — and a page of "best" and "worst" is exactly
 * where a missing caveat reads as a tip.
 */

type Locale = (typeof LOCALES)[number];

const STRINGS = [
  "link",
  "title",
  "description",
  "heading",
  "unavailable",
  "best",
  "worst",
  "range",
  "result",
  "neverRecentred",
  "recentringSame",
  "note",
] as const satisfies readonly (keyof CasesCopy)[];

/** Every sentence a template writes, filled with stand-ins the assertions can find. */
const templated = (copy: CasesCopy) => ({
  titleOn: copy.titleOn("Polygon"),
  descriptionOn: copy.descriptionOn("Polygon"),
  intro: copy.intro("Polygon", "$1,000"),
  criterion: copy.criterion("$1,000"),
  measuredAt: copy.measuredAt("2026-10-07 09:40 UTC"),
  notYet: copy.notYet("Polygon"),
  empty: copy.empty("Polygon"),
  poolsRead: copy.poolsRead("12", "19"),
  window: copy.window("2026-09-07", "2026-10-06"),
  recentres: copy.recentres("3"),
  recentringBetter: copy.recentringBetter("$118"),
  recentringWorse: copy.recentringWorse("$118"),
});

const FIGURES: Record<keyof ReturnType<typeof templated>, readonly string[]> = {
  titleOn: ["Polygon"],
  descriptionOn: ["Polygon"],
  intro: ["Polygon", "$1,000"],
  criterion: ["$1,000"],
  measuredAt: ["2026-10-07 09:40 UTC"],
  notYet: ["Polygon"],
  empty: ["Polygon"],
  poolsRead: ["12", "19"],
  window: ["2026-09-07", "2026-10-06"],
  recentres: ["3"],
  recentringBetter: ["$118"],
  recentringWorse: ["$118"],
};

/** The word each language uses to say it is not a recommendation, as the other copy modules say it. */
const NOT_A_RECOMMENDATION: Record<Locale, string> = {
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

/** And the word for a forecast, which the page says it is not. */
const NOT_A_FORECAST: Record<Locale, string> = {
  en: "forecast",
  tr: "tahmin",
  de: "Vorhersage",
  es: "pronóstico",
  ar: "توقّع",
  hi: "अनुमान",
  zh: "预测",
  ru: "прогноз",
  pt: "previsão",
  "zh-Hant": "預測",
};

describe("the cases page's words", () => {
  const english = getCasesCopy("en");

  it("are written in every language, none left in English or empty", () => {
    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getCasesCopy(locale);
      for (const key of STRINGS) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      const theirs = templated(copy);
      const ours = templated(english);
      for (const key of Object.keys(theirs) as (keyof typeof theirs)[]) {
        expect(theirs[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(theirs[key], `${locale} ${key}`).not.toBe(ours[key]);
      }
    }
  });

  it("put every figure they are given into their sentences, in every language", () => {
    for (const locale of LOCALES) {
      const lines = templated(getCasesCopy(locale));
      for (const [key, figures] of Object.entries(FIGURES) as [keyof typeof lines, readonly string[]][]) {
        for (const figure of figures) expect(lines[key], `${locale} ${key}`).toContain(figure);
      }
    }
  });

  it("say on every card that it is a measurement of a month that already happened, not a forecast or a recommendation", () => {
    for (const locale of LOCALES) {
      const { note, criterion } = getCasesCopy(locale);
      expect(note, locale).toContain(NOT_A_RECOMMENDATION[locale]);
      expect(note.toLowerCase(), locale).toContain(NOT_A_FORECAST[locale].toLowerCase());
      expect(note.length, locale).toBeGreaterThan(60);
      /* The order's criterion names the deposit it is measured on, so "best" is never a bare word. */
      expect(criterion("$1,000"), locale).toContain("$1,000");
    }
  });

  it("say the figures are the pool page's own, and that an incomplete month is left out, before any card", () => {
    for (const locale of LOCALES) {
      const { intro, poolsRead, notYet } = getCasesCopy(locale);
      expect(intro("Polygon", "$1,000").length, locale).toBeGreaterThan(120);
      expect(poolsRead("12", "19").length, locale).toBeGreaterThan(80);
      /* The cold page says when it fills: never on a visit. */
      expect(notYet("Polygon").length, locale).toBeGreaterThan(60);
    }
  });

  it("use each language's own words for a range, fees and a pool, as the rest of the site does", () => {
    const terms: Partial<Record<Locale, readonly string[]>> = {
      tr: ["aralık", "komisyon", "havuz"],
      ar: ["نطاق", "رسوم", "تجمّع"],
      hi: ["दायरा", "शुल्क", "पूल"],
      de: ["Bereich", "Gebühren", "Pool"],
      es: ["rango", "comisiones", "pool"],
      ru: ["диапазон", "комиссии", "пул"],
      pt: ["faixa", "taxas", "pool"],
      zh: ["区间", "手续费", "资金池"],
      "zh-Hant": ["區間", "手續費", "資金池"],
    };
    for (const [locale, words] of Object.entries(terms) as [Locale, readonly string[]][]) {
      const copy = getCasesCopy(locale);
      const all = [...STRINGS.map((key) => copy[key]), ...Object.values(templated(copy))].join("\n").toLowerCase();
      for (const word of words) expect(all, `${locale} ${word}`).toContain(word.toLowerCase());
    }
  });
});
