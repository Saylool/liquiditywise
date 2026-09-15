import { describe, expect, it } from "vitest";

import { OutOfSampleCheckSchema, OutOfSampleFoldSchema } from "./index";

/*
 * Fed directly, because the calculator cannot produce these shapes — which is
 * exactly why the guards against them need tests of their own. A refinement
 * nothing ever exercises is a comment with a runtime cost.
 */

const DAY_MS = 86_400_000;
const at = (index: number) => new Date(Date.parse("2026-05-01T00:00:00.000Z") + index * DAY_MS).toISOString();

const check = (overrides: Record<string, unknown> = {}) => ({
  fitRangeStart: at(60),
  fitRangeEndExclusive: at(91),
  measuredRangeStart: at(91),
  measuredRangeEndExclusive: at(121),
  originTimestamp: at(90),
  originPrice: 1_000,
  lowerPrice: 920,
  upperPrice: 1_087,
  annualizedVolatility: 0.3045,
  horizonDays: 30,
  standardDeviationMultiplier: 1,
  daysMeasured: 30,
  occupancy: { fullyInside: 3, fullyOutside: 26, undetermined: 1 },
  ...overrides,
});

describe("OutOfSampleFoldSchema", () => {
  it("accepts a check whose windows meet", () => {
    expect(OutOfSampleFoldSchema.safeParse(check()).success).toBe(true);
  });

  /*
   * The whole claim. A gap between the windows discards days; an overlap puts
   * days the fit saw back into the test, which is the in-sample problem this
   * exists to escape, reappearing where nobody would look for it.
   */
  it.each([
    /*
     * Each of these is a well-formed check in every other respect — the origin
     * still sits inside its fit window and the measurement still spans the whole
     * horizon — so the only rule left to reject them is the one under test.
     */
    [
      "a gap between them",
      { measuredRangeStart: at(92), measuredRangeEndExclusive: at(122) },
    ],
    ["an overlap", { fitRangeEndExclusive: at(92) }],
  ])("refuses windows with %s", (_label, overrides) => {
    expect(OutOfSampleFoldSchema.safeParse(check(overrides)).success).toBe(false);
  });

  it("refuses a band centred on a price from the window being tested", () => {
    const leaked = check({ originTimestamp: at(95) });

    expect(OutOfSampleFoldSchema.safeParse(leaked).success).toBe(false);
  });

  it("refuses an origin from before the fit window", () => {
    expect(OutOfSampleFoldSchema.safeParse(check({ originTimestamp: at(10) })).success).toBe(false);
  });

  it("refuses a fit window with no days in it", () => {
    const empty = check({ fitRangeStart: at(91) });

    expect(OutOfSampleFoldSchema.safeParse(empty).success).toBe(false);
  });

  it.each([
    ["below the band", { originPrice: 900 }],
    ["above the band", { originPrice: 1_200 }],
  ])("refuses an origin %s it was supposedly centred on", (_label, overrides) => {
    expect(OutOfSampleFoldSchema.safeParse(check(overrides)).success).toBe(false);
  });

  it("accepts an origin exactly on an edge, which a collapsed band gives", () => {
    const collapsed = check({ originPrice: 1_000, lowerPrice: 1_000, upperPrice: 1_000 });

    expect(OutOfSampleFoldSchema.safeParse(collapsed).success).toBe(true);
  });

  /*
   * A 30-day band checked over 20 days is not a check of a 30-day band, and the
   * shorter window flatters it: fewer days is fewer chances to leave the range.
   */
  it("refuses a measurement that does not span the whole horizon", () => {
    const short = check({ measuredRangeEndExclusive: at(111) });

    expect(OutOfSampleFoldSchema.safeParse(short).success).toBe(false);
  });

  it("refuses a split that does not account for every measured day", () => {
    const lost = check({ occupancy: { fullyInside: 3, fullyOutside: 26, undetermined: 0 } });

    expect(OutOfSampleFoldSchema.safeParse(lost).success).toBe(false);
  });

  /*
   * Fewer observed days than the horizon is ordinary — the source skips days.
   * More is arithmetically impossible and means the windows were mismeasured.
   */
  it("accepts fewer observed days than the horizon has", () => {
    const withGaps = check({
      daysMeasured: 28,
      occupancy: { fullyInside: 3, fullyOutside: 24, undetermined: 1 },
    });

    expect(OutOfSampleFoldSchema.safeParse(withGaps).success).toBe(true);
  });

  it("refuses more observed days than the horizon has", () => {
    const impossible = check({
      daysMeasured: 31,
      occupancy: { fullyInside: 4, fullyOutside: 26, undetermined: 1 },
    });

    expect(OutOfSampleFoldSchema.safeParse(impossible).success).toBe(false);
  });

  it.each([
    ["a negative volatility", { annualizedVolatility: -0.1 }],
    ["a zero multiplier", { standardDeviationMultiplier: 0 }],
    ["a fractional horizon", { horizonDays: 30.5 }],
    ["no days measured at all", { daysMeasured: 0 }],
    ["a timestamp that is not a canonical instant", { originTimestamp: "2026-07-30T00:00:00Z" }],
    ["a field nobody put there", { heldUp: true }],
  ])("refuses %s", (_label, overrides) => {
    expect(OutOfSampleFoldSchema.safeParse(check(overrides)).success).toBe(false);
  });
});


/*
 * The roll-up above the folds. Its figures are the ones a reader takes away, so
 * every one of them is re-derived from the rows rather than believed.
 */
describe("OutOfSampleCheckSchema", () => {
  const fold = (offset: number, inside: number) => ({
    ...check({
      fitRangeStart: at(60 + offset),
      fitRangeEndExclusive: at(91 + offset),
      measuredRangeStart: at(91 + offset),
      measuredRangeEndExclusive: at(121 + offset),
      originTimestamp: at(90 + offset),
      occupancy: { fullyInside: inside, fullyOutside: 30 - inside, undetermined: 0 },
    }),
  });

  const rollUp = (overrides: Record<string, unknown> = {}) => ({
    horizonDays: 30,
    standardDeviationMultiplier: 1,
    folds: [fold(-30, 3), fold(0, 26)],
    daysMeasured: 60,
    occupancy: { fullyInside: 29, fullyOutside: 31, undetermined: 0 },
    ...overrides,
  });

  it("accepts folds that tile the history", () => {
    expect(OutOfSampleCheckSchema.safeParse(rollUp()).success).toBe(true);
  });

  it("accepts a single fold, which a long horizon leaves", () => {
    const alone = rollUp({
      folds: [fold(0, 3)],
      daysMeasured: 30,
      occupancy: { fullyInside: 3, fullyOutside: 27, undetermined: 0 },
    });

    expect(OutOfSampleCheckSchema.safeParse(alone).success).toBe(true);
  });

  it("refuses a check with no folds in it", () => {
    const empty = rollUp({
      folds: [],
      daysMeasured: 0,
      occupancy: { fullyInside: 0, fullyOutside: 0, undetermined: 0 },
    });

    expect(OutOfSampleCheckSchema.safeParse(empty).success).toBe(false);
  });

  /*
   * A gap drops days from the count; an overlap counts them twice and inflates
   * whichever verdict those days happened to support. Both look like an ordinary
   * table.
   */
  it.each([
    ["a gap between folds", [fold(-60, 3), fold(0, 26)]],
    ["an overlap between folds", [fold(-15, 3), fold(0, 26)]],
    ["folds in the wrong order", [fold(0, 26), fold(-30, 3)]],
  ])("refuses %s", (_label, folds) => {
    expect(OutOfSampleCheckSchema.safeParse(rollUp({ folds })).success).toBe(false);
  });

  it.each([
    ["a day total that is not the folds added up", { daysMeasured: 61 }],
    ["an inside count that is not the folds added up", {
      occupancy: { fullyInside: 30, fullyOutside: 31, undetermined: 0 },
    }],
  ])("refuses %s", (_label, overrides) => {
    expect(OutOfSampleCheckSchema.safeParse(rollUp(overrides)).success).toBe(false);
  });

  it("refuses a fold drawn with settings the reader did not choose", () => {
    const mismatched = rollUp({ standardDeviationMultiplier: 2 });

    expect(OutOfSampleCheckSchema.safeParse(mismatched).success).toBe(false);
  });

  it("refuses a field nobody put there", () => {
    expect(OutOfSampleCheckSchema.safeParse(rollUp({ heldOverall: true })).success).toBe(false);
  });
});
