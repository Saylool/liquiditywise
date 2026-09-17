import { describe, expect, it } from "vitest";

import { getDictionary } from "./dictionaries";
import { LOCALES } from "./locales";

/*
 * The front page is the one page no test renders — it is a Server Component
 * that reads the request's own language — so its copy is checked here instead.
 *
 * Nothing below can tell whether a sentence is true. What it can tell is that
 * the two languages describe the same application: the compiler checks that
 * both dictionaries have a `coverage` key, and nothing but this checks that
 * they list the same things under it. A version dropped in translation would
 * be a page telling a Turkish reader that less exists than an English one is
 * told, which is the failure this file exists for.
 */

const HOME = Object.fromEntries(LOCALES.map((locale) => [locale, getDictionary(locale).home]));

describe("the front page's copy", () => {
  it("offers the same lists in both languages", () => {
    const shapes = LOCALES.map((locale) => ({
      steps: HOME[locale]?.methodSteps.length,
      versions: HOME[locale]?.coverage.map((entry) => entry.features.length),
    }));

    expect(new Set(shapes.map((shape) => JSON.stringify(shape))).size).toBe(1);
    expect(shapes[0]?.steps).toBeGreaterThan(0);
    expect(shapes[0]?.versions?.length).toBeGreaterThan(0);
  });

  it("names the same protocols under the same headings", () => {
    const versions = LOCALES.map((locale) => HOME[locale]?.coverage.map((entry) => entry.version));

    expect(new Set(versions.map((list) => JSON.stringify(list))).size).toBe(1);
  });

  it.each(LOCALES)("says something in %s everywhere it offers to", (locale) => {
    const home = HOME[locale];
    if (home === undefined) throw new Error(`no copy for ${locale}`);

    expect(home.workingTodayBody.length).toBeGreaterThan(200);
    for (const { step, detail } of home.methodSteps) {
      expect(step.trim().length).toBeGreaterThan(3);
      expect(detail.trim().length).toBeGreaterThan(40);
    }
    for (const { features } of home.coverage) {
      for (const { name, summary } of features) {
        expect(name.trim().length).toBeGreaterThan(3);
        expect(summary.trim().length).toBeGreaterThan(40);
      }
    }
  });

});
