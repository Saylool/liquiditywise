import { describe, expect, it } from "vitest";

import { createExplanationBudget, EXPLANATIONS_PER_HOUR } from "./explanationBudget";

describe("the hourly ceiling on new explanations", () => {
  it("allows sixty in an hour and refuses the sixty-first", () => {
    const budget = createExplanationBudget(() => 0);

    const taken = Array.from({ length: EXPLANATIONS_PER_HOUR + 1 }, () => budget.take());

    expect(EXPLANATIONS_PER_HOUR).toBe(60);
    expect(taken.filter(Boolean)).toHaveLength(60);
    expect(taken.at(-1)).toBe(false);
  });

  it("opens again once the hour is over", () => {
    let now = 0;
    const budget = createExplanationBudget(() => now);
    for (let index = 0; index < EXPLANATIONS_PER_HOUR; index += 1) budget.take();

    expect(budget.take()).toBe(false);
    now = 59 * 60 * 1_000;
    expect(budget.take()).toBe(false);
    now = 60 * 60 * 1_000;
    expect(budget.take()).toBe(true);
  });
});
