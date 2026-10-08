import { describe, expect, it } from "vitest";

import {
  containsStrayPlaceholder,
  TOKEN_A_PLACEHOLDER,
  TOKEN_B_PLACEHOLDER,
} from "./tokenPlaceholders";

describe("the token placeholders", () => {
  /* The numeral rule would refuse a name with a digit in it, so neither has one. */
  it("hold no figure", () => {
    expect(`${TOKEN_A_PLACEHOLDER}${TOKEN_B_PLACEHOLDER}`).not.toMatch(/\p{N}/u);
  });

  it.each([
    ["both, exactly", "The position holds only {TOKEN_A} below the range and only {TOKEN_B} above it."],
    ["one, twice", "{TOKEN_B} is what it holds below, and {TOKEN_B} is the one priced."],
    ["none at all", "Past either edge the position holds only one of the two tokens."],
    ["the word token, lower case", "A token_ab is not a placeholder, and nor are the tokens themselves."],
    ["in Arabic", "يحتفظ المركز بـ {TOKEN_A} فقط تحت النطاق وبـ {TOKEN_B} فقط فوقه."],
  ])("pass prose naming tokens by %s", (_label, prose) => {
    expect(containsStrayPlaceholder(prose)).toBe(false);
  });

  it.each([
    ["a name nobody defined", "The position holds only {TOKEN_C} below the range."],
    ["another word in braces", "The position holds only {POOL} below the range."],
    ["the right name in the wrong case", "The position holds only {token_a} below the range."],
    ["a name missing its braces", "The position holds only TOKEN_B below the range."],
    ["a name missing its braces, in lower case", "The position holds only token_a below the range."],
    ["a brace left open", "The position holds only {TOKEN_A below the range."],
    ["a brace left unopened", "The position holds only TOKEN_A} below the range."],
    ["a lone brace", "The position holds only one } of the two tokens."],
    ["empty braces", "The position holds only {} below the range."],
    ["placeholders run together", "The position holds only {TOKEN_A{TOKEN_B}} below the range."],
  ])("refuse %s", (_label, prose) => {
    expect(containsStrayPlaceholder(prose)).toBe(true);
  });

  /* The exported pattern is global; a stateful `test` would pass every other call. */
  it("gives the same verdict however many times it is asked", () => {
    const prose = "The position holds only {TOKEN_A} below the range.";

    expect([1, 2, 3].map(() => containsStrayPlaceholder(prose))).toEqual([false, false, false]);
  });
});
