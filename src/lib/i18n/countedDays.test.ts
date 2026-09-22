import { describe, expect, it } from "vitest";

import { getDictionary } from "./dictionaries";

/*
 * The one piece of grammar this interface has to get right by hand.
 *
 * Most of the copy is written once per language and never varies. A count
 * does vary, and in two of these languages the noun beside it changes with
 * it: Portuguese wants "1 dia" but "30 dias", and Russian wants "30 дней",
 * "31 день" and "22 дня" — three forms, not two.
 *
 * One is reachable. The horizon comes from the query string and the schema
 * accepts anything it allows, so `?days=1` is a page somebody can open; and
 * the counts the page prints for itself include 31, the volatility window,
 * which Russian would get wrong with the form 30 takes.
 *
 * Two different answers, each right for its language: Portuguese picks the
 * form, Russian uses the abbreviation every number takes. Both are easy to
 * "simplify" into a single plural by someone who does not read them, which
 * is what this is here to stop.
 */
describe("a day count, beside its noun", () => {
  it("takes the singular for one in Portuguese, and the plural above it", () => {
    const { parameters } = getDictionary("pt");

    expect(parameters.days("1")).toBe("1 dia");
    expect(parameters.days("7")).toBe("7 dias");
    expect(parameters.days("30")).toBe("30 dias");
  });

  it("agrees in the Portuguese sentences that carry a count too", () => {
    const { deposit, report } = getDictionary("pt");

    expect(deposit.collectedNote("1")).toContain("1 dia em que");
    expect(deposit.collectedNote("30")).toContain("30 dias em que");
    expect(report.horizonMove("1")).toBe("Em 1 dia");
    expect(report.horizonMove("90")).toBe("Em 90 dias");
  });

  /*
   * Russian is not given a singular to pick, because picking one would not be
   * enough: it has a third form for 2–4. The abbreviation is correct for all
   * of them, which is why it is there and why it must not be "improved" into
   * "дней".
   */
  it("uses a form every number takes in Russian", () => {
    const { parameters } = getDictionary("ru");

    for (const count of ["1", "22", "30", "31"]) {
      expect(parameters.days(count)).toBe(`${count} дн.`);
    }
  });
});
