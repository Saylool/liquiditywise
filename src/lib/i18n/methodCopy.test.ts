import { describe, expect, it } from "vitest";

import { methodFigures } from "../../components/MethodPage";
import { LOCALES } from "./locales";
import { getMethodCopy, METHOD_SECTION_IDS, type MethodFigures } from "./methodCopy";

/*
 * The methodology page's words, in every language. A section left in English,
 * or a paragraph dropped from one translation, would leave a reader in that
 * language with a shorter account of how the figures are made than the one
 * everybody else reads — so both are held here.
 */

const english = getMethodCopy("en");
const englishFigures = methodFigures("en");

const paragraphsOf = (locale: (typeof LOCALES)[number], figures: MethodFigures) => {
  const copy = getMethodCopy(locale);
  return METHOD_SECTION_IDS.flatMap((id) => copy.sections[id].paragraphs(figures));
};

describe("the method page's words", () => {
  it("are written in every language, not left in English", () => {
    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getMethodCopy(locale);
      for (const key of ["link", "pointer", "title", "description", "heading", "lead", "contentsHeading", "notAdvice"] as const) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      for (const id of METHOD_SECTION_IDS) {
        expect(copy.sections[id].title, `${locale} ${id}`).not.toBe(english.sections[id].title);
        const figures = methodFigures(locale);
        const theirs = copy.sections[id].paragraphs(figures);
        const ours = english.sections[id].paragraphs(englishFigures);
        theirs.forEach((paragraph, index) => {
          expect(paragraph.trim(), `${locale} ${id} ${index}`).not.toBe("");
          expect(paragraph, `${locale} ${id} ${index}`).not.toBe(ours[index]);
        });
      }
    }
  });

  it("give every section the same number of paragraphs in every language", () => {
    for (const locale of LOCALES) {
      for (const id of METHOD_SECTION_IDS) {
        expect(getMethodCopy(locale).sections[id].paragraphs(methodFigures(locale)), `${locale} ${id}`).toHaveLength(
          english.sections[id].paragraphs(englishFigures).length,
        );
      }
    }
  });

  /*
   * Each figure the code holds is handed to the prose rather than written into
   * it; a translation that dropped one would be silently missing a floor or a
   * window the English states.
   */
  it("state every figure the code holds, in every language", () => {
    for (const locale of LOCALES) {
      const figures = methodFigures(locale);
      const text = paragraphsOf(locale, figures).join("\n");
      for (const [name, value] of Object.entries(figures)) {
        expect(text, `${locale} ${name}`).toContain(value);
      }
    }
  });

  it("say that nothing on it is advice, and date the measurement it cites, in every language", () => {
    for (const locale of LOCALES) {
      expect(getMethodCopy(locale).notAdvice.length, locale).toBeGreaterThan(40);
      expect(paragraphsOf(locale, methodFigures(locale)).join("\n"), locale).toContain("2026-09-30");
    }
  });
});

describe("the figures the method page states", () => {
  it("are the code's own, formatted for the reader", () => {
    expect(englishFigures).toMatchObject({
      closes: "31",
      returns: "30",
      historyDays: "121",
      yearDays: "365",
      horizons: "7, 30, or 90",
      defaultHorizon: "30",
      multipliers: "1σ, 1.5σ, 2σ, or 3σ",
      defaultMultiplier: "1σ",
      freshMinutes: "15",
      smartPools: "12",
      positionsPerPool: "100",
      minPositionUsd: "$10,000",
      minWindowDays: "3",
      smartShare: "20%",
      ownerSets: "8",
      pairFloorUsd: "$100,000",
      v4OnlyChains: "Unichain",
      v3OnlyChains: "Celo",
      sourcifyOnlyChains: "BNB Chain and Avalanche",
      hookPoolCap: "1,000",
      hookCheckHours: "12",
      hookCheckRetryMinutes: "10",
    });
  });

  it("name every network read, and only those whose positions can be listed for smart liquidity", () => {
    for (const name of ["Ethereum", "Base", "Arbitrum One", "Unichain", "OP Mainnet", "Polygon", "BNB Chain", "Avalanche", "Celo"]) {
      expect(englishFigures.chains, name).toContain(name);
    }
    for (const name of ["BNB Chain", "Avalanche", "Celo"]) expect(englishFigures.smartChains, name).not.toContain(name);
    expect(englishFigures.smartChains).not.toContain("Unichain");
    expect(englishFigures.smartChains).toContain("Arbitrum One");
  });

  it("keep a list of decimals readable where a decimal is written with a comma", () => {
    expect(methodFigures("tr").multipliers).toContain("1,5σ");
  });
});
