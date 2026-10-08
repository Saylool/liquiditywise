import { describe, expect, it } from "vitest";

import { INTERPRETATION_METHOD, RangeInterpretationSchema } from "../../schemas";
import {
  interpretationWithTokenSymbols,
  sectionWithTokenSymbols,
  withTokenSymbols,
} from "./tokenSymbols";

const SYMBOLS = { token0: "USDC", token1: "WETH" };

describe("withTokenSymbols", () => {
  it("puts each token's symbol where its placeholder stood", () => {
    expect(withTokenSymbols("Below it holds {TOKEN_B}; above it, {TOKEN_A}.", SYMBOLS)).toBe(
      "Below it holds WETH; above it, USDC.",
    );
  });

  it("replaces every occurrence, not only the first", () => {
    expect(withTokenSymbols("{TOKEN_A}, {TOKEN_A} and {TOKEN_B}", SYMBOLS)).toBe("USDC, USDC and WETH");
  });

  it("leaves prose that names no token as it was", () => {
    const prose = "Past either edge the position holds only one of the two tokens.";

    expect(withTokenSymbols(prose, SYMBOLS)).toBe(prose);
  });

  /*
   * One pass. A symbol reading "{TOKEN_B}" is those characters, not a way to
   * rename the other token in somebody else's sentence.
   */
  it("never substitutes inside a symbol it has just put in", () => {
    expect(withTokenSymbols("{TOKEN_A} then {TOKEN_B}", { token0: "{TOKEN_B}", token1: "{TOKEN_A}" })).toBe(
      "{TOKEN_B} then {TOKEN_A}",
    );
  });

  /* `String.replace` reads "$&" in a replacement string as the match; a function does not. */
  it("puts a symbol in verbatim, whatever it contains", () => {
    expect(withTokenSymbols("holds {TOKEN_A}", { token0: "$&$1$$", token1: "x" })).toBe("holds $&$1$$");
  });

  /*
   * Not escaped here: the page renders the prose as a React text node, which
   * escapes it exactly as it escapes the symbol everywhere else. Escaping here
   * too would show "&amp;" to a reader of a token called "A&B".
   */
  it("hands back plain text, for the page to escape as it escapes every symbol", () => {
    expect(withTokenSymbols("holds {TOKEN_A}", { token0: "<script>A&B</script>", token1: "x" })).toBe(
      "holds <script>A&B</script>",
    );
  });

  /*
   * Right-to-left prose is touched only where a placeholder stood: the
   * Arabic around it is the same characters in the same order, and the
   * symbol goes in as one run, left to right as the page writes it.
   */
  it("leaves right-to-left prose as it was around each symbol", () => {
    const before = "يحتفظ المركز بـ ";
    const between = " فقط تحت النطاق وبـ ";
    const after = " فقط فوقه.";
    const written = withTokenSymbols(`${before}{TOKEN_B}${between}{TOKEN_A}${after}`, SYMBOLS);

    expect(written).toBe(`${before}WETH${between}USDC${after}`);
    expect(written).not.toMatch(/[‎‏‪-‮⁦-⁩]/u);
  });
});

describe("interpretationWithTokenSymbols", () => {
  const verified = RangeInterpretationSchema.parse({
    method: INTERPRETATION_METHOD,
    whatThisRangeMeans:
      "The suggested range is a band of {TOKEN_B} prices quoted in {TOKEN_A}, drawn from how far this pair has moved.",
    ifPriceLeavesTheRange:
      "Below the range the position holds only {TOKEN_B}, and above it only {TOKEN_A}, and it earns nothing until price returns.",
    whatTheVolatilitySays:
      "The volatility figure measures how far the daily price has moved over the window shown. It describes the past only.",
    whatThisDoesNotCover:
      "Nothing here accounts for the fees a position would earn, the gas spent opening it, or whether {TOKEN_A} is trustworthy.",
  });

  it("puts the symbols into every section", () => {
    const written = interpretationWithTokenSymbols(verified, SYMBOLS);

    expect(JSON.stringify(written)).not.toContain("{TOKEN_");
    expect(written.whatThisRangeMeans).toContain("band of WETH prices quoted in USDC");
    expect(written.ifPriceLeavesTheRange).toContain("holds only WETH, and above it only USDC");
    expect(written.whatThisDoesNotCover).toContain("whether USDC is trustworthy");
  });

  it("leaves the application's own label alone", () => {
    expect(interpretationWithTokenSymbols(verified, SYMBOLS).method).toBe(INTERPRETATION_METHOD);
  });
});

describe("sectionWithTokenSymbols", () => {
  it("hands an early paragraph on with the symbols in it, under its own key", () => {
    const seen: [string, string][] = [];
    sectionWithTokenSymbols((key, prose) => seen.push([key, prose]), SYMBOLS)(
      "ifPriceLeavesTheRange",
      "It holds only {TOKEN_A}.",
    );

    expect(seen).toEqual([["ifPriceLeavesTheRange", "It holds only USDC."]]);
  });
});
