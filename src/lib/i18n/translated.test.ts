import { describe, expect, it } from "vitest";

import { getDictionary } from "./dictionaries";
import { FULLY_TRANSLATED, isFullyTranslated, LOCALES, type Locale } from "./locales";

/*
 * Every string the interface shows, in every language, checked for the one
 * failure the compiler cannot see: an English sentence pasted into the Turkish
 * object.
 *
 * The type makes a *missing* key a build error, which is the easy half. The
 * other half is a key that is present and still English, and it is the likely
 * one: copy is added to both objects by hand, and the second is written last.
 *
 * So the rule is inverted. Rather than listing what must be translated, this
 * requires that everything is, and keeps a short list of what is deliberately
 * the same — each with the reason it is. The list is checked in both
 * directions: an entry that stops being identical is as much a mistake as a
 * string that starts being.
 */

/** Paths that read the same as English on purpose, per language, and why. */
const TURKISH_SAME_AS_ENGLISH: ReadonlyMap<string, string> = new Map([
  [".metadata.title", "the product's name, which is not translated"],
  [".home.title", "the product's name, which is not translated"],
  [".pool.back", "the product's name behind an arrow, which is not translated"],
  [".home.coverage[0].version", "the protocol's own name, which is not translated"],
  [".home.coverage[1].version", "the protocol's own name, which is not translated"],
  [".feeTiers.hook", "the word the Turkish copy uses for a hook throughout"],
  [".holdings.hookTag", "the word the Turkish copy uses for a hook throughout"],
  [".search.v4Hook", "the word the Turkish copy uses for a hook throughout"],
  [".search.placeholder", "two token symbols, which are not words"],
]);

/** Every string in a dictionary, by the path it sits at. */
const strings = (value: unknown, path = ""): readonly (readonly [string, string])[] => {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => strings(item, `${path}.${key}`));
  }

  return [];
};

const english = new Map(strings(getDictionary("en")));

/** The same, for German. Mostly words German and English happen to share. */
const GERMAN_SAME_AS_ENGLISH: ReadonlyMap<string, string> = new Map([
  [".metadata.title", "the product's name, which is not translated"],
  [".home.title", "the product's name, which is not translated"],
  [".pool.back", "the product's name behind an arrow, which is not translated"],
  [".home.coverage[0].version", "the protocol's own name, which is not translated"],
  [".home.coverage[1].version", "the protocol's own name, which is not translated"],
  [".preferences.themeSystem", "German for the system's own setting is the same word"],
  [".rangeOrder.band", "German uses the same word for a band of prices"],
  [".feeTiers.hook", "the word German writing about v4 uses for a hook, untranslated"],
  [".holdings.hookTag", "the word German writing about v4 uses for a hook, untranslated"],
  [".search.v4Hook", "the word German writing about v4 uses for a hook, untranslated"],
  [".search.placeholder", "two token symbols, which are not words"],
]);

/** And for Spanish, which keeps the English word for a hook as the others do. */
const SPANISH_SAME_AS_ENGLISH: ReadonlyMap<string, string> = new Map([
  [".metadata.title", "the product's name, which is not translated"],
  [".home.title", "the product's name, which is not translated"],
  [".pool.back", "the product's name behind an arrow, which is not translated"],
  [".home.coverage[0].version", "the protocol's own name, which is not translated"],
  [".home.coverage[1].version", "the protocol's own name, which is not translated"],
  [".feeTiers.hook", "the word Spanish writing about v4 uses for a hook, untranslated"],
  [".holdings.hookTag", "the word Spanish writing about v4 uses for a hook, untranslated"],
  [".search.v4Hook", "the word Spanish writing about v4 uses for a hook, untranslated"],
  [".search.placeholder", "two token symbols, which are not words"],
]);

/**
 * And for Arabic, where the word for a hook stays in Latin script.
 *
 * Deliberate rather than untranslated: a hook is named by its address in the
 * protocol's own documentation, and a reader following that term across to here
 * meets the same letters. Transliterating it would put a word between them and
 * the thing it names.
 */
const ARABIC_SAME_AS_ENGLISH: ReadonlyMap<string, string> = new Map([
  [".metadata.title", "the product's name, which is not translated"],
  [".home.title", "the product's name, which is not translated"],
  [".pool.back", "the product's name behind an arrow, which is not translated"],
  [".home.coverage[0].version", "the protocol's own name, which is not translated"],
  [".home.coverage[1].version", "the protocol's own name, which is not translated"],
  [".feeTiers.hook", "the term Arabic writing about v4 keeps in Latin script"],
  [".holdings.hookTag", "the term Arabic writing about v4 keeps in Latin script"],
  [".search.v4Hook", "the term Arabic writing about v4 keeps in Latin script"],
  [".search.placeholder", "two token symbols, which are not words"],
]);

/** And for Hindi, which keeps the same term in Latin script for the same reason. */
const HINDI_SAME_AS_ENGLISH: ReadonlyMap<string, string> = new Map([
  [".metadata.title", "the product's name, which is not translated"],
  [".home.title", "the product's name, which is not translated"],
  [".pool.back", "the product's name behind an arrow, which is not translated"],
  [".home.coverage[0].version", "the protocol's own name, which is not translated"],
  [".home.coverage[1].version", "the protocol's own name, which is not translated"],
  [".feeTiers.hook", "the term Hindi writing about v4 keeps in Latin script"],
  [".holdings.hookTag", "the term Hindi writing about v4 keeps in Latin script"],
  [".search.v4Hook", "the term Hindi writing about v4 keeps in Latin script"],
  [".search.placeholder", "two token symbols, which are not words"],
]);

/** And for Chinese, which keeps the same term in Latin script for the same reason. */
const CHINESE_SAME_AS_ENGLISH: ReadonlyMap<string, string> = new Map([
  [".metadata.title", "the product's name, which is not translated"],
  [".home.title", "the product's name, which is not translated"],
  [".pool.back", "the product's name behind an arrow, which is not translated"],
  [".home.coverage[0].version", "the protocol's own name, which is not translated"],
  [".home.coverage[1].version", "the protocol's own name, which is not translated"],
  [".feeTiers.hook", "the term Chinese writing about v4 keeps in Latin script"],
  [".holdings.hookTag", "the term Chinese writing about v4 keeps in Latin script"],
  [".search.v4Hook", "the term Chinese writing about v4 keeps in Latin script"],
  [".search.placeholder", "two token symbols, which are not words"],
]);

const EXEMPT: ReadonlyMap<Locale, ReadonlyMap<string, string>> = new Map([
  ["tr", TURKISH_SAME_AS_ENGLISH],
  ["de", GERMAN_SAME_AS_ENGLISH],
  ["es", SPANISH_SAME_AS_ENGLISH],
  ["ar", ARABIC_SAME_AS_ENGLISH],
  ["hi", HINDI_SAME_AS_ENGLISH],
  ["zh", CHINESE_SAME_AS_ENGLISH],
]);

/*
 * Driven by `FULLY_TRANSLATED` rather than by a list written here, so promoting
 * a language is one edit and this starts holding it to the same standard the
 * same day. A language still being translated is checked by the block below
 * instead, which asks something weaker and true of it.
 */
describe.each(FULLY_TRANSLATED.filter((locale) => locale !== "en"))(
  "the %s dictionary",
  (locale) => {
    const translated = strings(getDictionary(locale));
    const exempt = EXEMPT.get(locale) ?? new Map<string, string>();

    it("carries a comparable number of strings", () => {
      expect(english.size).toBeGreaterThan(300);
      expect(translated).toHaveLength(english.size);
    });

    it("never leaves an English string standing as its own translation", () => {
      const untranslated = translated
        .filter(([path, value]) => english.get(path) === value)
        .map(([path]) => path)
        .filter((path) => !exempt.has(path));

      expect(untranslated).toEqual([]);
    });

    /* A reason that has stopped applying is a reason nobody will notice is wrong. */
    it("keeps no reason for a string that has since been translated", () => {
      const stale = [...exempt.keys()].filter(
        (path) => english.get(path) !== translated.find(([at]) => at === path)?.[1],
      );

      expect(stale).toEqual([]);
    });

    it("gives a reason for every string it exempts", () => {
      for (const [path, reason] of exempt) {
        expect(reason.length, path).toBeGreaterThan(20);
      }
    });
  },
);

/*
 * The languages whose interface is translated and whose explanations are not.
 *
 * Nothing here demands completeness — that is the point of the state. What it
 * demands is that the state is real: a partial dictionary that translated
 * nothing would render an entirely English page while the interface claimed,
 * in that language, to be partly translated. And every string must still be
 * present, because a reader meets a missing one as a blank rather than as
 * English.
 */
describe.each(LOCALES.filter((locale) => !isFullyTranslated(locale)))(
  "the %s dictionary, still being translated",
  (locale) => {
    const translated = strings(getDictionary(locale));

    it("has every string English has", () => {
      expect(translated).toHaveLength(english.size);
    });

    it("has actually translated some of them", () => {
      const changed = translated.filter(([path, value]) => english.get(path) !== value);

      expect(changed.length).toBeGreaterThan(15);
    });

    /* The sentence that says the rest is English has to be in the language. */
    it("says so in its own language", () => {
      const notice = getDictionary(locale).preferences.partlyTranslated;

      expect(notice).not.toBe(getDictionary("en").preferences.partlyTranslated);
      expect(notice.length).toBeGreaterThan(20);
    });

    /*
     * And the claim in the other direction, which nothing held anyone to.
     *
     * A dictionary with every sentence already written, left out of
     * `FULLY_TRANSLATED`, renders a page that tells its reader — in their own
     * language — that the explanations below are still English while they are
     * not. Nobody reading that page can tell it is wrong, because the page
     * looks right; the only thing that can tell is this.
     *
     * Twenty, not one: the handful that read the same as English in every
     * language — the protocol’s names, the placeholder’s two symbols — are
     * counted here too, because a language still being translated has no
     * exemption list yet. A dictionary that is genuinely part-written has
     * hundreds.
     */
    it("still has English left in it, or it should be promoted", () => {
      const untranslated = translated.filter(([path, value]) => english.get(path) === value);

      expect(untranslated.length).toBeGreaterThan(20);
    });
  },
);
