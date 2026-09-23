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

  /*
   * The explanation is written in the reader's own language, and three of the
   * ten this interface publishes do not write figures with 0-9. `\\d` matched
   * only those, so "النطاق يغطي ٣٠ يومًا" — a figure the model invented, in
   * Arabic — passed the one rule the whole contract exists for. Each of these
   * was checked against the old rule and got through it.
   */
  it.each([
    ["Arabic-Indic digits", "النطاق يغطي ٣٠ يومًا من الأسعار المرصودة، وهي النافذة التي يقيس بها هذا التحليل مدى تحرك السعر عادة قبل رسم النطاق حول المستوى الحالي."],
    ["Devanagari digits", "यह दायरा ३० दिनों की कीमतों पर आधारित है, और यही वह अवधि है जिससे यह विश्लेषण मापता है कि कीमत आमतौर पर कितनी दूर तक जाती है इस बैंड को खींचने से पहले।"],
    ["Persian digits", "این محدوده ۳۰ روز قیمت را پوشش می‌دهد و همین بازه است که این تحلیل با آن اندازه می‌گیرد قیمت معمولا چقدر جابه‌جا می‌شود پیش از آنکه باند ترسیم شود."],
    ["fullwidth digits", "この範囲は３０日ぶんの終値にもとづいており、価格がふだんどれだけ動くかをこの分析が測るための窓として使われている期間そのものです。ここに書かれた数字は本文の役目ではありません。"],
  ])("rejects prose stating a figure with %s", (_label, prose) => {
    expect(
      RangeInterpretationSchema.safeParse({ ...valid, whatThisRangeMeans: prose }).success,
    ).toBe(false);
  });

  /*
   * Not only the decimal digits. A fraction, a superscript, an enclosed
   * numeral and the CJK zero are all figures a model can reach for, and none
   * of them has an innocent use in a paragraph about a price range — so the
   * rule is the whole Number category, and these pin that choice rather than
   * leaving it to whichever of two plausible categories was typed first.
   */
  it.each([
    ["a vulgar fraction", "The band was drawn ½ as wide as the movement measured over the window, which is what makes it sit this close to the current price rather than further out."],
    ["an enclosed numeral", "Reading them in order: ① the band, then how far the pair has actually travelled, and then what either of those leaves out, which is the part most worth your attention."],
    ["the CJK zero in a year", "この分析は二〇二六年の日次終値にもとづいており、価格がどれだけ動いたかを測る窓として使われています。数字そのものはこの文章の隣に表示されます。"],
  ])("rejects prose stating %s", (_label, prose) => {
    expect(
      RangeInterpretationSchema.safeParse({ ...valid, whatThisRangeMeans: prose }).success,
    ).toBe(false);
  });

  /*
   * The boundary, stated on purpose. A number spelled as a word is not caught,
   * in any language, because "one" and 一 are ordinary parts of a sentence and
   * a rule that rejected them would reject nearly every paragraph. The brief
   * forbids figures in words too; this rule is the backstop for the form a
   * backstop can recognise, and pretending otherwise would be worse than
   * saying so.
   */
  /*
   * It used to pass, and a test said so out loud — that was the honest limit
   * of a digit rule. A spelled-out figure was then seen in real output, in
   * Portuguese, and the limit was closed for every number from eleven up.
   */
  it("rejects a figure spelled out as a word", () => {
    const spelled = {
      ...valid,
      whatThisRangeMeans:
        "The band was scaled over thirty days, which is the window this analysis uses when it works out how far the price has tended to travel before it settles again.",
    };

    expect(RangeInterpretationSchema.safeParse(spelled).success).toBe(false);
  });

  /* The boundary, still stated on purpose: zero to ten is grammar, not a figure. */
  it("still lets one and two be words", () => {
    const small = {
      ...valid,
      whatThisRangeMeans:
        "One of the two tokens is what a position holds once the price leaves the range on either side, and which one depends on the edge it crossed on the way out.",
    };

    expect(RangeInterpretationSchema.safeParse(small).success).toBe(true);
  });

  /*
   * Non-Latin prose that states no figure must still pass. A rule that
   * rejected Arabic or Chinese wholesale would take the explanation away from
   * those readers entirely, which is the opposite of what it is for.
   */
  it.each([
    ["Arabic", "يغطي هذا النطاق حركة السعر التي رُصدت خلال النافذة المعروضة أعلاه، والنطاق مرسوم حول السعر الحالي بما يتناسب مع مدى تلك الحركة كما تظهر بجانب هذا النص."],
    ["Chinese", "这个区间是围绕上方显示的当前价格画出的，宽度取自所显示窗口内价格实际走过的幅度，具体数字就在这段文字旁边，不由这里复述。"],
    ["Hindi", "यह दायरा ऊपर दिखाई गई मौजूदा कीमत के आसपास खींचा गया है, और इसकी चौड़ाई उस अवधि में कीमत की वास्तविक गति से ली गई है जो साथ में दिखाई गई है।"],
  ])("accepts %s prose that states no figure", (_label, prose) => {
    expect(
      RangeInterpretationSchema.safeParse({ ...valid, whatThisRangeMeans: prose }).success,
    ).toBe(true);
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

  /*
   * The bound is sized for the longest language the interface publishes, and
   * this is the case that proves it. Measured against the live model on one
   * pool, the same four sections came back at 392/333/479/518 characters in
   * English and 471/297/710/653 in Turkish. At the old bound of 700 the Turkish
   * answer was rejected whole for one section being ten characters over, and the
   * reader was shown "no explanation" instead of a good one.
   *
   * A bound only one of two published languages can meet is a bug in the bound.
   */
  it("accepts a section as long as the longest published language has produced", () => {
    const asLongAsTurkishRuns = `A section of ordinary prose. ${"Turkish runs longer. ".repeat(45)}`;

    expect(asLongAsTurkishRuns.length).toBeGreaterThan(957);
    expect(
      RangeInterpretationSchema.safeParse({ ...valid, whatTheVolatilitySays: asLongAsTurkishRuns })
        .success,
    ).toBe(true);
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
