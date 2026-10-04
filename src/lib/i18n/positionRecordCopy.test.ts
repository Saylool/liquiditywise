import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getPositionRecordCopy } from "./positionRecordCopy";

/*
 * The record's words, in every language. A label left in English, a figure
 * dropped from a sentence, or a language that forgot to say what the record
 * leaves out would each leave its reader with less than the English one.
 */

type Locale = (typeof LOCALES)[number];

describe("the record's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getPositionRecordCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getPositionRecordCopy(locale);
      for (const key of [
        "deposited",
        "withdrawn",
        "now",
        "fees",
        "held",
        "result",
        "note",
        "unverified",
        "unread",
        "v4",
      ] as const) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      expect(copy.heading("2024-05-01", "USDC"), locale).not.toBe(english.heading("2024-05-01", "USDC"));
      expect(copy.parts("+5 USDC", "-2 USDC"), locale).not.toBe(english.parts("+5 USDC", "-2 USDC"));
    }
  });

  it("put every figure they are given into their sentences, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getPositionRecordCopy(locale);
      const heading = copy.heading("2024-05-01", "USDC");
      const parts = copy.parts("+290.5 USDC", "-140.25 USDC");

      expect(heading, locale).toContain("2024-05-01");
      expect(heading, locale).toContain("USDC");
      /* Fees first, then the range effect, in every language, so the two never trade places. */
      expect(parts.indexOf("+290.5 USDC"), locale).toBeGreaterThanOrEqual(0);
      expect(parts.indexOf("-140.25 USDC"), locale).toBeGreaterThan(parts.indexOf("+290.5 USDC"));
    }
  });

  /* What it leaves out is said beside it every time it is shown, not only on the method page. */
  it("say that gas is left out, that everything is at today's price, and that it is no advice, in every language", () => {
    const LEAVES_OUT: Record<Locale, readonly string[]> = {
      en: ["gas", "today's price", "whole life", "impermanent loss", "not advice"],
      tr: ["gas", "bugünkü fiyat", "bütün ömrünü", "geçici kayıp", "tavsiyesi değildir"],
      de: ["Gas", "heutigen Preis", "ganze Laufzeit", "Impermanent Loss", "keine Finanzberatung"],
      es: ["gas", "precio de hoy", "toda la vida", "pérdida impermanente", "no asesoramiento"],
      ar: ["الغاز", "بسعر اليوم", "عمر المركز كله", "الخسارة غير الدائمة", "ليس نصيحة"],
      hi: ["गैस", "आज की कीमत", "पूरे जीवनकाल", "अस्थायी हानि", "सलाह नहीं"],
      zh: ["gas", "今天的价格", "整个存续期间", "无常损失", "不构成财务建议"],
      ru: ["gas", "сегодняшней цене", "вся жизнь", "непостоянными потерями", "не финансовый совет"],
      pt: ["gas", "preço de hoje", "vida inteira", "perda impermanente", "não uma recomendação"],
      "zh-Hant": ["gas", "今天的價格", "整個存續期間", "無常損失", "不構成財務建議"],
    };

    for (const locale of LOCALES) {
      const { note } = getPositionRecordCopy(locale);
      for (const words of LEAVES_OUT[locale]) expect(note, `${locale}: ${words}`).toContain(words);
    }
  });

  /*
   * The site's own words in each language, the ones its other pages use for
   * the same things — so the record does not call a position or its range
   * something the panel above it does not.
   */
  it("use the terms the rest of the site uses in each language", () => {
    const TERMS: Partial<Record<Locale, readonly string[]>> = {
      tr: ["pozisyon", "komisyon", "aralık", "likidite"],
      /* سيولة takes its pronoun as سيولته here, so its stem is what is looked for. */
      ar: ["مركز", "رسوم", "نطاق", "سيول"],
      hi: ["पोज़िशन", "शुल्क", "दायरे", "तरलता"],
      zh: ["仓位", "手续费", "区间", "流动性"],
      "zh-Hant": ["倉位", "手續費", "區間", "流動性", "期間"],
    };

    for (const [locale, terms] of Object.entries(TERMS) as [Locale, readonly string[]][]) {
      const copy = getPositionRecordCopy(locale);
      const all = [copy.heading("1", "X"), copy.now, copy.fees, copy.parts("1", "2"), copy.note, copy.unverified, copy.v4]
        .join(" ")
        .toLocaleLowerCase(locale);
      for (const term of terms) expect(all, `${locale}: ${term}`).toContain(term.toLocaleLowerCase(locale));
    }
  });

  it("say why there are no figures in a sentence of its own, distinct for each reason", () => {
    for (const locale of LOCALES) {
      const { unverified, unread, v4 } = getPositionRecordCopy(locale);
      expect(new Set([unverified, unread, v4]).size, locale).toBe(3);
    }
  });
});
