import { describe, expect, it } from "vitest";

import { INTERPRETATION_METHOD, RangeInterpretationSchema } from "./interpretation";

const section = (text: string) => text;

const valid = {
  method: INTERPRETATION_METHOD,
  whatThisRangeMeans: section(
    "The suggested range covers the prices shown above, sitting either side of where the pool trades right now. While price stays inside it, the position is the one earning fees in this pool.",
  ),
  ifPriceLeavesTheRange: section(
    "Once price moves past either edge, the position converts entirely into one of the two tokens and stops earning fees. It starts earning again only if price comes back inside the bounds.",
  ),
  whatTheVolatilitySays: section(
    "The volatility figure measures how much the daily closing price has moved over the window shown. It describes the past; it is not a forecast, and a quiet month can be followed by a loud one.",
  ),
  whatThisDoesNotCover: section(
    "Nothing here accounts for the fees a position would earn, the impermanent loss it would carry, the gas spent opening and closing it, or the possibility that the pool itself behaves unusually.",
  ),
};

describe("RangeInterpretationSchema", () => {
  it("accepts a plain-language explanation", () => {
    expect(RangeInterpretationSchema.safeParse(valid).success).toBe(true);
  });

  /*
   * The rule the whole contract exists for. Every number a reader sees comes
   * from verified data; a figure written by the model is the one failure that
   * would read as authoritative while being wrong.
   */
  it.each([
    ["a percentage", "The annualised volatility of 70.5% means the price moves a fair amount over a year, which is what widened this particular range."],
    ["a tick", "The lower bound sits at tick 195970, which is where the position would stop earning fees if price fell that far over the coming weeks."],
    ["a price", "The pool currently trades around 0.000396 WETH per USDC, and the range was drawn either side of that level using the measured movement."],
    ["a horizon in digits", "The band was scaled over 30 days, which is the window this analysis uses when it works out how far price has tended to travel."],
    ["a bare year", "Since 2024 this pair has traded actively, so there is plenty of history behind the figure that set the width of this range."],
  ])("rejects prose stating %s", (_label, prose) => {
    expect(
      RangeInterpretationSchema.safeParse({ ...valid, whatThisRangeMeans: prose }).success,
    ).toBe(false);
  });

  it("still allows the protocol's own version names", () => {
    // "Uniswap v3" is a name, not a figure, and has to remain writable.
    const withVersion = {
      ...valid,
      whatThisRangeMeans:
        "A Uniswap v3 position earns fees only across the band its owner chose, which is what makes picking that band the decision worth understanding here. Uniswap v4 keeps the same idea.",
    };

    expect(RangeInterpretationSchema.safeParse(withVersion).success).toBe(true);
  });

  it("rejects a section too short to explain anything", () => {
    expect(
      RangeInterpretationSchema.safeParse({ ...valid, whatThisDoesNotCover: "It depends." }).success,
    ).toBe(false);
  });

  it("rejects a section long enough to bury the point", () => {
    const essay = "The range covers a band of prices around the current level. ".repeat(20);

    expect(
      RangeInterpretationSchema.safeParse({ ...valid, whatThisRangeMeans: essay }).success,
    ).toBe(false);
  });

  it("requires every section", () => {
    const missing: Record<string, unknown> = { ...valid };
    delete missing["whatTheVolatilitySays"];

    expect(RangeInterpretationSchema.safeParse(missing).success).toBe(false);
  });

  /*
   * A field the model can fill is a field the model will fill. An educational
   * tool that grades a position has started advising, whatever its disclaimer
   * says — so the shape has nowhere to put a grade.
   */
  it.each([
    ["a risk level", { riskLevel: "high" }],
    ["a recommendation", { recommendation: "open this position" }],
    ["a confidence score", { confidence: 0.8 }],
    ["a rating", { score: 7 }],
  ])("refuses %s", (_label, extra) => {
    expect(RangeInterpretationSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
  });

  it("refuses another model's label", () => {
    expect(
      RangeInterpretationSchema.safeParse({ ...valid, method: "freeform-commentary" }).success,
    ).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const padded = { ...valid, whatThisRangeMeans: `\n  ${valid.whatThisRangeMeans}  \n` };
    const parsed = RangeInterpretationSchema.safeParse(padded);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.whatThisRangeMeans).toBe(valid.whatThisRangeMeans);
  });
});
