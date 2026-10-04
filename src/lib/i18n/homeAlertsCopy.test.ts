import { describe, expect, it } from "vitest";

import { getHomeAlertsCopy } from "./homeAlertsCopy";
import { LOCALES } from "./locales";

describe("the front page's alerts section", () => {
  it("is written in every language, not left in English", () => {
    const english = getHomeAlertsCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getHomeAlertsCopy(locale);
      for (const key of ["kicker", "heading", "telegramTitle", "telegramBody", "telegramCta", "pairCta"] as const) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
    }
  });

  it("names the bot's handle in every language, and says /smart and /weekly are what to send for the opt-in messages", () => {
    for (const locale of LOCALES) {
      const copy = getHomeAlertsCopy(locale);

      expect(copy.telegramBot("LiquidityWiseBot"), locale).toContain("@LiquidityWiseBot");
      expect(copy.telegramBody, locale).toContain("/smart");
      expect(copy.telegramBody, locale).toContain("/weekly");
    }
  });
});
