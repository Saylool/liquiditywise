import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getPositionRecordCopy } from "./positionRecordCopy";
import { getPositionShareCopy } from "./positionShareCopy";

/*
 * The words of sharing a record, in every language. A link label left in
 * English, a figure dropped from the post, or a card that forgot to say it
 * is a measurement and not advice would each hand a reader less than the
 * English one gets — and the post is the one sentence of this site that
 * leaves it, so what it keeps matters most.
 */

type Locale = (typeof LOCALES)[number];

describe("the share row's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getPositionShareCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getPositionShareCopy(locale);
      for (const key of ["heading", "image", "post", "link", "note"] as const) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      for (const key of ["title", "range", "against", "footer", "unverified"] as const) {
        expect(copy.card[key].trim(), `${locale} card.${key}`).not.toBe("");
        expect(copy.card[key], `${locale} card.${key}`).not.toBe(english.card[key]);
      }
      expect(copy.text("USDC / WETH", "+5 USDC", "+7 USDC", "2024-05-01"), locale).not.toBe(
        english.text("USDC / WETH", "+5 USDC", "+7 USDC", "2024-05-01"),
      );
      expect(copy.card.since("2024-05-01"), locale).not.toBe(english.card.since("2024-05-01"));
    }
  });

  it("put every figure they are given into the post, result before fees, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getPositionShareCopy(locale);
      const post = copy.text("XOR / WETH", "-3 XOR", "+5 XOR", "2024-05-01");

      expect(post, locale).toContain("XOR / WETH");
      expect(post, locale).toContain("2024-05-01");
      expect(post.indexOf("-3 XOR"), locale).toBeGreaterThanOrEqual(0);
      expect(post.indexOf("+5 XOR"), locale).toBeGreaterThan(post.indexOf("-3 XOR"));
      expect(copy.card.since("2024-05-01"), locale).toContain("2024-05-01");
    }
  });

  /* The one sentence that leaves the site says where it was measured and that it is not advice, and so does every card. */
  it("say, in the post and on the card, that it is a measurement from this site and not advice, in every language", () => {
    const NOT_ADVICE: Record<Locale, string> = {
      en: "not advice",
      tr: "tavsiyesi değildir",
      de: "keine Finanzberatung",
      es: "no asesoramiento",
      ar: "ليس نصيحة",
      hi: "सलाह नहीं",
      zh: "不构成财务建议",
      ru: "не финансовый совет",
      pt: "não é recomendação",
      "zh-Hant": "不構成財務建議",
    };
    const MEASURED: Record<Locale, string> = {
      en: "Measured",
      tr: "ölçüldü",
      de: "Gemessen",
      es: "Medido",
      ar: "قياس",
      hi: "मापा गया",
      zh: "测量",
      ru: "Измерено",
      pt: "Medido",
      "zh-Hant": "測量",
    };

    for (const locale of LOCALES) {
      const copy = getPositionShareCopy(locale);
      const post = copy.text("A / B", "1", "2", "3");
      expect(post, locale).toContain("LiquidityWise");
      expect(post, locale).toContain(MEASURED[locale]);
      expect(post.toLocaleLowerCase(locale), locale).toContain(NOT_ADVICE[locale].toLocaleLowerCase(locale));
      expect(copy.card.footer, locale).toContain("liquiditywise.com");
      expect(copy.card.footer.toLocaleLowerCase(locale), locale).toContain(NOT_ADVICE[locale].toLocaleLowerCase(locale));
    }
  });

  it("say the card names only the position's public token id, in every language", () => {
    const TOKEN_ID: Record<Locale, string> = {
      en: "token id",
      tr: "token kimliği",
      de: "Token-ID",
      es: "id público del token",
      ar: "معرّف رمز",
      hi: "टोकन आईडी",
      zh: "代币 id",
      ru: "id токена",
      pt: "id público do token",
      "zh-Hant": "代幣 id",
    };

    for (const locale of LOCALES) expect(getPositionShareCopy(locale).note, locale).toContain(TOKEN_ID[locale]);
  });

  /*
   * The site's own words in each language, the ones its other pages use for
   * the same things — so the card does not call a position or its range
   * something the row it was offered on does not.
   */
  it("use the terms the rest of the site uses in each language", () => {
    const TERMS: Partial<Record<Locale, readonly string[]>> = {
      tr: ["pozisyon", "komisyon", "aralık"],
      ar: ["مركز", "رسوم", "نطاق"],
      hi: ["पोज़िशन", "शुल्क", "दायरा"],
      zh: ["仓位", "手续费", "区间"],
      "zh-Hant": ["倉位", "手續費", "區間"],
    };

    for (const [locale, terms] of Object.entries(TERMS) as [Locale, readonly string[]][]) {
      const copy = getPositionShareCopy(locale);
      const all = [copy.note, copy.text("1", "2", "3", "4"), copy.card.title, copy.card.range, copy.card.unverified]
        .join(" ")
        .toLocaleLowerCase(locale);
      for (const term of terms) expect(all, `${locale}: ${term}`).toContain(term.toLocaleLowerCase(locale));
    }
  });

  /* The card says why there is no figure in words of its own, distinct from the row's. */
  it("say on the card why there is no figure in a sentence distinct from the record's own", () => {
    for (const locale of LOCALES) {
      expect(getPositionShareCopy(locale).card.unverified, locale).not.toBe(getPositionRecordCopy(locale).unverified);
    }
  });

  it("keep the post short enough to post, with room for the card's address", () => {
    for (const locale of LOCALES) {
      const post = getPositionShareCopy(locale).text("USDC / WETH", "+1,234.56 USDC", "+2,345.67 USDC", "2024-05-01");
      /* X counts 280, and an attached address counts 23 whatever its length. */
      expect([...post].length, locale).toBeLessThan(280 - 23);
    }
  });
});
