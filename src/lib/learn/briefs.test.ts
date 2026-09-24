import { describe, expect, it } from "vitest";

import { getDictionary } from "../i18n/dictionaries";
import { LOCALES, type Locale } from "../i18n/locales";
import { BRIEF_IDS, getLearnCopy } from "./briefs";

describe("the quick guide", () => {
  it("says the same six things in every language, in the same order, three sentences each", () => {
    for (const locale of LOCALES) {
      const copy = getLearnCopy(locale);

      expect(copy.briefs.map(({ id }) => id), locale).toEqual([...BRIEF_IDS]);
      for (const brief of copy.briefs) {
        expect(brief.points, `${locale} ${brief.id}`).toHaveLength(3);
        expect(new Set(brief.points).size, `${locale} ${brief.id}`).toBe(3);
        expect(brief.title.trim(), `${locale} ${brief.id}`).not.toBe("");
      }
    }
  });

  it("is written in each language, not left in English", () => {
    const english = getLearnCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getLearnCopy(locale);
      expect(copy.intro, locale).not.toBe(english.intro);
      copy.briefs.forEach((brief, index) => {
        brief.points.forEach((point, sentence) => {
          expect(point, `${locale} ${brief.id} ${sentence}`).not.toBe(english.briefs[index]!.points[sentence]);
        });
      });
    }
  });

  /*
   * The word each language's pool pages use for impermanent loss, taken from
   * the same dictionary that page is built from — so the guide and the pool
   * page cannot drift into two names for one thing.
   */
  it("calls impermanent loss what the pool pages call it, in every language", () => {
    const TERM: Record<Locale, string> = {
      en: "impermanent loss",
      tr: "geçici kayıp",
      de: "Impermanent Loss",
      es: "pérdida impermanente",
      ar: "الخسارة غير الدائمة",
      hi: "अस्थायी हानि",
      zh: "无常损失",
      // The dictionary declines it ("непостоянными потерями"); the root is what both share.
      ru: "непостоянн",
      pt: "perda impermanente",
      "zh-Hant": "無常損失",
    };

    for (const locale of LOCALES) {
      const note = getDictionary(locale).divergence.impermanentNote;
      expect(note, `${locale}: the dictionary itself`).toContain(TERM[locale]);

      const brief = getLearnCopy(locale).briefs.find(({ id }) => id === "divergence")!;
      expect(brief.title.toLowerCase(), locale).toContain(TERM[locale].toLowerCase());
    }
  });

  it("uses the Turkish interface's words, not their near-synonyms", () => {
    const text = JSON.stringify(getLearnCopy("tr"));

    expect(text).toContain("komisyon");
    expect(text).toContain("takas");
    expect(text).toContain("fiyat adımı");
    // No \b here: to a JavaScript regex "ü" is not a word character, so \bücret never matches.
    expect(text).not.toMatch(/ücret/i);
    expect(text).not.toMatch(/\bswap/i);
    expect(text).not.toMatch(/\bgaz\b/i);
  });

  it("keeps the German to the interface's words for a swap and a deposit", () => {
    const text = JSON.stringify(getLearnCopy("de"));

    expect(text).toContain("Tausch");
    expect(text).toContain("Einlage");
    expect(text).not.toMatch(/\bSwap/);
    expect(text).not.toContain("Einzahlung");
  });

  it("fits a search result: a title and a description of sensible length in every language", () => {
    for (const locale of LOCALES) {
      const { title, description } = getLearnCopy(locale);
      expect(title.length, locale).toBeLessThanOrEqual(90);
      expect(description.length, locale).toBeGreaterThan(40);
      expect(description.length, locale).toBeLessThanOrEqual(200);
    }
  });
});
