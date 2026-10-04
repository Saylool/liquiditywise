import { describe, expect, it } from "vitest";

import { getAboutCopy } from "./aboutCopy";
import { LOCALES } from "./locales";

describe("the about page's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getAboutCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getAboutCopy(locale);
      for (const key of ["link", "heading", "lead", "limitsHeading", "factsHeading", "tryHeading", "description"] as const) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      copy.points.forEach((point, index) => {
        expect(point.body, `${locale} point ${index}`).not.toBe(english.points[index]?.body);
      });
    }
  });

  it("keep the site's name and address spelled the same everywhere", () => {
    for (const locale of LOCALES) {
      expect(getAboutCopy(locale).facts[0].value, locale).toBe("LiquidityWise · liquiditywise.com");
    }
  });

  it("say it is not affiliated with Uniswap Labs, in every language", () => {
    for (const locale of LOCALES) {
      expect(getAboutCopy(locale).limits.join(" "), locale).toContain("Uniswap Labs");
    }
  });

  it("name every language and every network the site covers", () => {
    for (const locale of LOCALES) {
      const networks = getAboutCopy(locale).facts[2].value;
      for (const name of ["Ethereum", "Base", "Arbitrum", "Unichain", "OP Mainnet", "Polygon", "BNB Chain", "Avalanche", "Celo"]) {
        expect(networks, `${locale} ${name}`).toContain(name);
      }
    }
  });
});
