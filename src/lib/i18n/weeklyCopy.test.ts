import { describe, expect, it } from "vitest";

import { getDictionary } from "./dictionaries";
import { LOCALES } from "./locales";
import { getWeeklyCopy } from "./weeklyCopy";

describe("the weekly page's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getWeeklyCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getWeeklyCopy(locale);
      for (const key of ["link", "title", "description", "heading", "quiet", "topHeading", "detail", "bot", "unavailable", "loading"] as const) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      for (const [key, theirs, ours] of [
        ["titleOn", copy.titleOn("Base"), english.titleOn("Base")],
        ["intro", copy.intro("Base"), english.intro("Base")],
        ["window", copy.window("A", "B", "7"), english.window("A", "B", "7")],
        ["notYet", copy.notYet("Base"), english.notYet("Base")],
        ["topYield", copy.topYield("34%", "9"), english.topYield("34%", "9")],
      ] as const) {
        expect(theirs.trim(), `${locale} ${key}`).not.toBe("");
        expect(theirs, `${locale} ${key}`).not.toBe(ours);
      }
    }
  });

  it("put every figure they are given into their sentences, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getWeeklyCopy(locale);
      for (const [line, figures] of [
        [copy.titleOn("Polygon"), ["Polygon"]],
        [copy.intro("Arbitrum One"), ["Arbitrum One"]],
        [copy.window("2026-09-28 09:00 UTC", "2026-10-05 06:00 UTC", "7"), ["2026-09-28 09:00 UTC", "2026-10-05 06:00 UTC", "7"]],
        [copy.notYet("Base"), ["Base"]],
        [copy.topYield("34%", "12"), ["34%", "12"]],
      ] as const) {
        for (const figure of figures) expect(line, locale).toContain(figure);
      }
    }
  });

  /* The window's dates are measurement times, written first-to-last; nothing here is an arrow that could point the wrong way. */
  it("write the week from its first measurement to its latest, in that order, in every language", () => {
    for (const locale of LOCALES) {
      const line = getWeeklyCopy(locale).window("FIRST", "LATEST", "7");
      expect(line.indexOf("FIRST"), locale).toBeGreaterThanOrEqual(0);
      expect(line.indexOf("FIRST"), locale).toBeLessThan(line.indexOf("LATEST"));
      expect(line, locale).not.toContain("←");
    }
  });

  /* Arabic writes Telegram in its own script, as the rest of the site's Arabic does. */
  it("say the bot sends the same digest, and that /weekly is what to send it, in every language", () => {
    for (const locale of LOCALES) {
      expect(getWeeklyCopy(locale).bot, locale).toContain("/weekly");
      expect(getWeeklyCopy(locale).bot, locale).toMatch(/Telegram|تيليغرام/);
    }
  });

  /*
   * Portuguese counts its days with a noun that agrees; Russian with the one
   * abbreviation every count takes (see countedDays.test.ts). The others say
   * the day count the way their smart-money trend heading does.
   */
  it("agree the day count with its noun where the language asks it", () => {
    expect(getWeeklyCopy("pt").window("A", "B", "1")).toContain("1 dia ");
    expect(getWeeklyCopy("pt").window("A", "B", "7")).toContain("7 dias");
    expect(getWeeklyCopy("ru").window("A", "B", "7")).toContain("7 дн.");
  });

  /*
   * The digest's own lines on the page are the dictionary's weekly strings,
   * which follow the smart-money page's terms; what is said around them must
   * use the same name for the thing. Held here for the one term every
   * language has a settled word for.
   */
  it("call the smart money what the smart-money page and the bot call it, in every language", () => {
    const SMART_MONEY: Record<(typeof LOCALES)[number], string> = {
      en: "smart money",
      tr: "akıllı para",
      de: "kluge Geld",
      es: "dinero inteligente",
      ar: "المال الذكي",
      hi: "स्मार्ट पैसा",
      zh: "聪明资金",
      ru: "умные деньги",
      pt: "dinheiro inteligente",
      "zh-Hant": "聰明資金",
    };

    for (const locale of LOCALES) {
      const term = SMART_MONEY[locale].toLowerCase();
      expect(getWeeklyCopy(locale).title.toLowerCase(), locale).toContain(term);
      expect(getWeeklyCopy(locale).intro("X").toLowerCase(), locale).toContain(term);
      /* The bot's own sentence about the digest uses the same term (and messages.test.ts holds the bot to the smart-money page). */
      expect(getDictionary(locale).telegram.weeklyOn.toLowerCase(), locale).toContain(term);
    }
  });
});
