import { describe, expect, it } from "vitest";

import { getDictionary } from "./dictionaries";
import { getEmailDigestCopy } from "./emailDigestCopy";
import { LOCALES } from "./locales";

/** Every string a copy holds, templates called with a placeholder, by the path it sits at. */
const strings = (value: unknown, path = ""): readonly (readonly [string, string])[] => {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") return strings((value as (chain: string) => string)("Base"), `${path}()`);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => strings(item, `${path}.${key}`));
  }
  return [];
};

describe("the e-mail digest's words", () => {
  const english = new Map(strings(getEmailDigestCopy("en")));

  it("are written in every language, not left in English, and leave nothing blank", () => {
    expect(english.size).toBeGreaterThan(25);

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      for (const [path, value] of strings(getEmailDigestCopy(locale))) {
        expect(value.trim(), `${locale} ${path}`).not.toBe("");
        expect(value, `${locale} ${path}`).not.toBe(english.get(path));
      }
    }
  });

  it("put the network they are given into their sentences, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getEmailDigestCopy(locale);
      for (const line of [copy.confirm.confirmed("Polygon"), copy.mail.confirmSubject("Polygon"), copy.mail.confirmIntro("Polygon")]) {
        expect(line, locale).toContain("Polygon");
      }
    }
  });

  /*
   * The sentence the whole feature stands on. It names the five things kept,
   * in English by their names, and in every language promises the deletion
   * — at once from the server, within seven days from the backups — in the
   * words the Telegram section uses for the same promise.
   */
  it("say exactly what is kept, and that unsubscribing deletes it", () => {
    const { privacy } = getEmailDigestCopy("en");

    for (const kept of ["address", "network", "language", "confirmed", "last digest went out"]) expect(privacy).toContain(kept);
    expect(privacy).toContain("nothing else");
    expect(privacy).toContain("at once");
    expect(privacy).toContain("encrypted backups within seven days");
  });

  it("promise the seven days in every language, with the word that language's /stop message uses", () => {
    const SEVEN: Record<(typeof LOCALES)[number], string> = {
      en: "seven days",
      tr: "yedi gün",
      de: "sieben Tagen",
      es: "siete días",
      ar: "سبعة أيام",
      hi: "सात दिनों",
      zh: "七天",
      ru: "семи дней",
      pt: "sete dias",
      "zh-Hant": "七天",
    };

    for (const locale of LOCALES) {
      const copy = getEmailDigestCopy(locale);
      expect(copy.privacy, locale).toContain(SEVEN[locale]);
      expect(copy.unsubscribe.removed, locale).toContain(SEVEN[locale]);
      /* The same promise the Telegram section makes, in the same words. */
      expect(getDictionary(locale).telegram.stopped, locale).toContain(SEVEN[locale]);
    }
  });

  /*
   * The card stands on the front page where no bot may be set up, and the
   * front page's test holds that section to naming no channel it cannot
   * offer; so the card's own words name none either.
   */
  it("name no other channel on the card", () => {
    for (const locale of LOCALES) {
      const copy = getEmailDigestCopy(locale);
      expect(`${copy.heading} ${copy.body} ${copy.homeCta}`, locale).not.toMatch(/Telegram|تيليغرام|t\.me/);
    }
  });

  it("say when the digest comes, the way the bot says it", () => {
    for (const locale of LOCALES) {
      expect(getEmailDigestCopy(locale).body, locale).toContain("08:00");
      expect(getDictionary(locale).telegram.weeklyOn, locale).toContain("08:00");
    }
  });

  /*
   * Everything around the digest uses the weekly page's term for the thing
   * the digest is about, so a reader moving between mail, page and form
   * meets one word.
   */
  it("call the smart money what the weekly page calls it, in every language", () => {
    const SMART_MONEY: Record<(typeof LOCALES)[number], string> = {
      en: "smart money",
      tr: "akıllı para",
      de: "kluge geld",
      es: "dinero inteligente",
      ar: "المال الذكي",
      hi: "स्मार्ट पैसा",
      zh: "聪明资金",
      ru: "умные деньги",
      pt: "dinheiro inteligente",
      "zh-Hant": "聰明資金",
    };

    for (const locale of LOCALES) {
      const copy = getEmailDigestCopy(locale);
      expect(copy.body.toLowerCase(), locale).toContain(SMART_MONEY[locale]);
      expect(copy.mail.confirmIntro("X").toLowerCase(), locale).toContain(SMART_MONEY[locale]);
    }
  });

  it("tell a reader whose link failed to ask again, and one whose link worked that nothing more is sent until the next Monday", () => {
    const { confirm, status } = getEmailDigestCopy("en");

    expect(confirm.unknown).toContain("again");
    expect(status.sent).toContain("within a day");
    expect(confirm.confirmed("Base")).toContain("next Monday");
  });
});
