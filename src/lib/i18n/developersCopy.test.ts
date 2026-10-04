import { describe, expect, it } from "vitest";

import { developerFigures } from "../../components/DevelopersPage";
import { EMBED_PARAMETERS, EMBED_STATUS_KINDS } from "../embed/embedDocs";
import { DEVELOPERS_SECTION_IDS, getDevelopersCopy, type DevelopersFigures } from "./developersCopy";
import { LOCALES, type Locale } from "./locales";

/*
 * The developers page's words, in every language. A sentence left in English,
 * or dropped from one translation, would leave a developer reading in that
 * language with less of the contract than everybody else — and a piece of
 * code translated along with the prose around it (`adres` for `address`)
 * would be a parameter the server has never heard of. Both are held here.
 */

/** Every string the page shows in one language, by the path it sits at, with that language's figures in it. */
const strings = (value: unknown, figures: DevelopersFigures, path = ""): readonly (readonly [string, string])[] => {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") return strings((value as (f: DevelopersFigures) => unknown)(figures), figures, `${path}()`);
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, figures, `${path}[${index}]`));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => strings(item, figures, `${path}.${key}`));
  }
  return [];
};

const of = (locale: Locale) => new Map(strings(getDevelopersCopy(locale), developerFigures(locale)));
const english = of("en");

/** The pieces of code in a sentence: whatever sits between a pair of backticks. */
const codeIn = (text: string): string[] => text.split("`").filter((_, index) => index % 2 === 1);

describe("the developers page's words", () => {
  it("are written in every language, not left in English", () => {
    expect(english.size).toBeGreaterThan(60);
    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      for (const [path, text] of of(locale)) {
        expect(text.trim(), `${locale} ${path}`).not.toBe("");
        expect(text, `${locale} ${path}`).not.toBe(english.get(path));
      }
    }
  });

  it("say the same things in every language: no paragraph, field or label missing or added", () => {
    for (const locale of LOCALES) {
      expect([...of(locale).keys()], locale).toEqual([...english.keys()]);
    }
  });

  it("cover every section, parameter, field and status the page shows", () => {
    for (const locale of LOCALES) {
      const copy = getDevelopersCopy(locale);
      const figures = developerFigures(locale);
      expect(Object.keys(copy.sections), locale).toEqual([...DEVELOPERS_SECTION_IDS]);
      expect(Object.keys(copy.parameters(figures)), locale).toEqual([...EMBED_PARAMETERS]);
      expect(Object.keys(copy.statuses(figures)), locale).toEqual([...EMBED_STATUS_KINDS]);
    }
  });

  /*
   * Each figure the code holds is handed to the prose rather than written into
   * it; a translation that dropped one would be silently missing a limit or a
   * lifetime the English states.
   */
  it("state every figure the code holds, in every language", () => {
    for (const locale of LOCALES) {
      const figures = developerFigures(locale);
      const text = [...of(locale).values()].join("\n");
      for (const [name, value] of Object.entries(figures)) {
        expect(text, `${locale} ${name}`).toContain(value);
      }
    }
  });

  /*
   * The check above cannot tell a figure handed in from the same number typed
   * into the sentence — "300" reads the same either way, and ten is both the
   * limit and the number of languages. So each language is also written out
   * with a marker in place of every figure, and each sentence has to carry
   * the same markers, as many times, as the English one does.
   */
  it("take every figure from the code rather than writing it in, sentence by sentence", () => {
    const markers = Object.fromEntries(
      Object.keys(developerFigures("en")).map((name) => [name, `[[${name}]]`]),
    ) as unknown as DevelopersFigures;
    const figuresIn = (locale: Locale) =>
      new Map(strings(getDevelopersCopy(locale), markers).map(([path, text]) => [path, (text.match(/\[\[\w+\]\]/g) ?? []).sort()]));
    const theirs = figuresIn("en");

    expect([...theirs.values()].flat().length).toBeGreaterThan(20);
    for (const locale of LOCALES) {
      for (const [path, found] of figuresIn(locale)) expect(found, `${locale} ${path}`).toEqual(theirs.get(path));
    }
  });

  it("set the same code in every sentence, in every language, and never translate it", () => {
    for (const locale of LOCALES) {
      for (const [path, text] of of(locale)) {
        expect(text.split("`").length % 2, `${locale} ${path}: an unclosed backtick`).toBe(1);
        expect(new Set(codeIn(text)), `${locale} ${path}`).toEqual(new Set(codeIn(english.get(path) ?? "")));
      }
    }
  });

  it("say the figures are not a recommendation, in every language, as the card's own disclaimer does", () => {
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

    for (const locale of LOCALES) {
      const terms = getDevelopersCopy(locale).terms(developerFigures(locale));
      expect(terms[0], locale).toContain(NOT_A_RECOMMENDATION[locale]);
      expect(terms[3], locale).toContain("MIT");
      expect(getDevelopersCopy(locale).links.code, locale).toContain("GitHub");
    }
  });

  /*
   * The words each language uses for these things everywhere else on the site
   * (2026-10-04: a native-reader pass settled them), so this page does not
   * introduce a second word for one thing.
   */
  it("use each language's own word for a pool, a hook and a page", () => {
    const prose = (locale: Locale) =>
      [...of(locale).values()].map((text) => text.split("`").filter((_, index) => index % 2 === 0).join(" ")).join("\n");

    expect(prose("ar")).toContain("تجمّع");
    expect(prose("ar")).toContain("خطّاف");
    expect(prose("ar")).not.toMatch(/\bhooks?\b/i);
    expect(prose("hi")).toContain("पृष्ठ");
    expect(prose("hi")).not.toContain("पेज");
    expect(prose("zh-Hant")).not.toMatch(/[“”]/);
    expect(prose("zh-Hant")).toContain("「");
  });
});
