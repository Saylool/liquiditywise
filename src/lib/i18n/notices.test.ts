import { describe, expect, it } from "vitest";

import { DataFailureNoticeSchema, DataWarningNoticeSchema } from "../../schemas";
import { getDictionary } from "./dictionaries";
import { LOCALES, type Locale } from "./locales";

/*
 * The compiler already refuses a dictionary that is missing a code — the entries
 * are written with `satisfies Record<DataFailureNotice, string>`. What it cannot
 * see is a code that was "translated" by pasting the English sentence into the
 * Turkish object, which is the failure mode this file exists for.
 */

/*
 * How short a sentence may be before it reads as a stub rather than an answer.
 *
 * Twenty characters is where that line falls in an alphabetic script. It is not
 * where it falls in Chinese, where one character carries about what a syllable
 * carries elsewhere: the shortest complete notice here is nine characters long
 * and says exactly what English needs thirty-four for. Holding it to twenty
 * would not be a stricter guard, it would be a guard on a different thing, and
 * the only way to pass it would be to pad a sentence that is already whole.
 *
 * So the floor is per language, at roughly a quarter of that language’s median
 * notice — which is what twenty is for English, whose median is eighty-two.
 * Chinese medians twenty-seven, and its shortest whole sentence is nine.
 *
 * Written out for every language rather than as one default with an exception,
 * so that adding a language means deciding its floor rather than inheriting a
 * number chosen for a script it may not share — and so that there is no single
 * default left to lower, which would weaken all seven at once and fail nothing.
 */
const SHORTEST_SENTENCE: Record<Locale, number> = {
  en: 20,
  tr: 20,
  de: 20,
  es: 20,
  ar: 20,
  hi: 20,
  zh: 8,
  ru: 20,
  pt: 20,
};

const FAILURES = DataFailureNoticeSchema.options;
const WARNINGS = DataWarningNoticeSchema.options;

describe("notices", () => {
  it("has a code for every one of them", () => {
    // A guard on the guard: an empty enum would make every loop below vacuous.
    expect(FAILURES.length).toBeGreaterThan(20);
    expect(WARNINGS.length).toBeGreaterThan(5);
  });

  it.each(LOCALES)("says something in %s for every failure", (locale) => {
    const { notices } = getDictionary(locale);

    for (const code of FAILURES) {
      expect(notices.failure[code].trim().length, code).toBeGreaterThan(SHORTEST_SENTENCE[locale]);
    }
  });

  it.each(LOCALES)("says something in %s for every caveat", (locale) => {
    const { notices } = getDictionary(locale);

    for (const code of WARNINGS) {
      expect(notices.warning[code].trim().length, code).toBeGreaterThan(SHORTEST_SENTENCE[locale]);
    }
  });

  it("never leaves a Turkish sentence as its English original", () => {
    const en = getDictionary("en").notices;
    const tr = getDictionary("tr").notices;

    const untranslated = [
      ...FAILURES.filter((code) => tr.failure[code] === en.failure[code]),
      ...WARNINGS.filter((code) => tr.warning[code] === en.warning[code]),
    ];

    expect(untranslated).toEqual([]);
  });

  /*
   * Two codes exist to be told apart, so two sentences that read the same defeat
   * the point of having both. The nearest pairs are the market-data and
   * on-chain variants of the same failure, which differ only in which source
   * they name — and that is the difference worth keeping.
   */
  it.each(LOCALES)("says something different in %s for each code", (locale) => {
    const { notices } = getDictionary(locale);
    const sentences = [
      ...FAILURES.map((code) => notices.failure[code]),
      ...WARNINGS.map((code) => notices.warning[code]),
    ];

    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it("never names an environment variable in something a visitor reads", () => {
    // Which variable to set is an operator's business, and the notice code
    // reaches them through the server log, where it is exact in every language.
    for (const locale of LOCALES) {
      const { notices } = getDictionary(locale);

      for (const code of FAILURES) {
        expect(notices.failure[code]).not.toMatch(/[A-Z][A-Z0-9]*_[A-Z0-9_]+/);
      }
    }
  });
});
