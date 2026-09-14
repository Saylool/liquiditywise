import { describe, expect, it } from "vitest";

import { PoolActivitySchema, RangeOccupancySchema } from "./index";

/*
 * Fed directly, because the calculator cannot produce these shapes — which is
 * exactly why the guards against them need a test of their own. A refinement
 * nothing ever exercises is a comment with a runtime cost.
 */

const activity = (overrides: Record<string, unknown> = {}) => ({
  daysMeasured: 31,
  volume24hUsd: 41_000_000,
  volume7dUsd: 482_000_000,
  volume30dUsd: 2_493_000_000,
  fees30dUsd: 1_246_548,
  occupancy: { fullyInside: 25, fullyOutside: 5, undetermined: 1 },
  feesWhileFullyInsideUsd: 1_002_969,
  ...overrides,
});

describe("RangeOccupancySchema", () => {
  it("accepts a split of real days", () => {
    expect(
      RangeOccupancySchema.safeParse({ fullyInside: 25, fullyOutside: 5, undetermined: 1 }).success,
    ).toBe(true);
  });

  it("refuses an occupancy with no days in it, which describes nothing", () => {
    expect(
      RangeOccupancySchema.safeParse({ fullyInside: 0, fullyOutside: 0, undetermined: 0 }).success,
    ).toBe(false);
  });

  it.each([
    ["a negative count", { fullyInside: -1, fullyOutside: 5, undetermined: 1 }],
    ["a fractional count", { fullyInside: 2.5, fullyOutside: 5, undetermined: 1 }],
  ])("refuses %s", (_label, occupancy) => {
    expect(RangeOccupancySchema.safeParse(occupancy).success).toBe(false);
  });
});

describe("PoolActivitySchema", () => {
  it("accepts a well-formed reading", () => {
    expect(PoolActivitySchema.safeParse(activity()).success).toBe(true);
  });

  it("accepts a window too short to fill its rolling sums", () => {
    // Null rather than a smaller total: four days is not a seven-day figure.
    const short = activity({
      daysMeasured: 3,
      occupancy: { fullyInside: 3, fullyOutside: 0, undetermined: 0 },
      volume7dUsd: null,
      volume30dUsd: null,
      fees30dUsd: null,
      feesWhileFullyInsideUsd: null,
    });

    expect(PoolActivitySchema.safeParse(short).success).toBe(true);
  });

  /*
   * A day that fell out of every bucket, or landed in two, means the classifier
   * lost track of it — and the figures beside it would be describing a different
   * number of days than the one reported.
   */
  it("refuses a split that does not account for every measured day", () => {
    const lost = activity({ occupancy: { fullyInside: 25, fullyOutside: 5, undetermined: 0 } });
    const doubled = activity({ occupancy: { fullyInside: 25, fullyOutside: 5, undetermined: 2 } });

    expect(PoolActivitySchema.safeParse(lost).success).toBe(false);
    expect(PoolActivitySchema.safeParse(doubled).success).toBe(false);
  });

  /*
   * Fees charged on a subset of the days cannot exceed the fees charged on all
   * of them. It is the one arithmetic relationship between two of these figures,
   * so it is the one that can be checked without recomputing either.
   */
  it("refuses more fees inside the range than the pool charged in total", () => {
    const impossible = activity({ feesWhileFullyInsideUsd: 1_300_000 });

    expect(PoolActivitySchema.safeParse(impossible).success).toBe(false);
  });

  it("accepts inside fees exactly equal to the total, which every day inside gives", () => {
    const allInside = activity({
      occupancy: { fullyInside: 31, fullyOutside: 0, undetermined: 0 },
      feesWhileFullyInsideUsd: 1_246_548,
    });

    expect(PoolActivitySchema.safeParse(allInside).success).toBe(true);
  });

  it("leaves the comparison alone when either side is unknown", () => {
    const unknownTotal = activity({ fees30dUsd: null });

    expect(PoolActivitySchema.safeParse(unknownTotal).success).toBe(true);
  });

  it.each([
    ["a negative volume", { volume24hUsd: -1 }],
    ["no days measured at all", { daysMeasured: 0 }],
    ["a field nobody put there", { yieldPercent: 12 }],
  ])("refuses %s", (_label, overrides) => {
    expect(PoolActivitySchema.safeParse(activity(overrides)).success).toBe(false);
  });
});
