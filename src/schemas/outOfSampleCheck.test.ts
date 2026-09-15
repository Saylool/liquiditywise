import { describe, expect, it } from "vitest";

import { OutOfSampleCheckSchema } from "./index";

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

describe("OutOfSampleCheckSchema", () => {
  it("accepts a check whose windows meet", () => {
    expect(OutOfSampleCheckSchema.safeParse(check()).success).toBe(true);
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
    expect(OutOfSampleCheckSchema.safeParse(check(overrides)).success).toBe(false);
  });

  it("refuses a band centred on a price from the window being tested", () => {
    const leaked = check({ originTimestamp: at(95) });

    expect(OutOfSampleCheckSchema.safeParse(leaked).success).toBe(false);
  });

  it("refuses an origin from before the fit window", () => {
    expect(OutOfSampleCheckSchema.safeParse(check({ originTimestamp: at(10) })).success).toBe(false);
  });

  it("refuses a fit window with no days in it", () => {
    const empty = check({ fitRangeStart: at(91) });

    expect(OutOfSampleCheckSchema.safeParse(empty).success).toBe(false);
  });

  it.each([
    ["below the band", { originPrice: 900 }],
    ["above the band", { originPrice: 1_200 }],
  ])("refuses an origin %s it was supposedly centred on", (_label, overrides) => {
    expect(OutOfSampleCheckSchema.safeParse(check(overrides)).success).toBe(false);
  });

  it("accepts an origin exactly on an edge, which a collapsed band gives", () => {
    const collapsed = check({ originPrice: 1_000, lowerPrice: 1_000, upperPrice: 1_000 });

    expect(OutOfSampleCheckSchema.safeParse(collapsed).success).toBe(true);
  });

  /*
   * A 30-day band checked over 20 days is not a check of a 30-day band, and the
   * shorter window flatters it: fewer days is fewer chances to leave the range.
   */
  it("refuses a measurement that does not span the whole horizon", () => {
    const short = check({ measuredRangeEndExclusive: at(111) });

    expect(OutOfSampleCheckSchema.safeParse(short).success).toBe(false);
  });

  it("refuses a split that does not account for every measured day", () => {
    const lost = check({ occupancy: { fullyInside: 3, fullyOutside: 26, undetermined: 0 } });

    expect(OutOfSampleCheckSchema.safeParse(lost).success).toBe(false);
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

    expect(OutOfSampleCheckSchema.safeParse(withGaps).success).toBe(true);
  });

  it("refuses more observed days than the horizon has", () => {
    const impossible = check({
      daysMeasured: 31,
      occupancy: { fullyInside: 4, fullyOutside: 26, undetermined: 1 },
    });

    expect(OutOfSampleCheckSchema.safeParse(impossible).success).toBe(false);
  });

  it.each([
    ["a negative volatility", { annualizedVolatility: -0.1 }],
    ["a zero multiplier", { standardDeviationMultiplier: 0 }],
    ["a fractional horizon", { horizonDays: 30.5 }],
    ["no days measured at all", { daysMeasured: 0 }],
    ["a timestamp that is not a canonical instant", { originTimestamp: "2026-07-30T00:00:00Z" }],
    ["a field nobody put there", { heldUp: true }],
  ])("refuses %s", (_label, overrides) => {
    expect(OutOfSampleCheckSchema.safeParse(check(overrides)).success).toBe(false);
  });
});
