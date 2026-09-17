import { describe, expect, it } from "vitest";

import {
  DEPOSIT_USD_MAXIMUM,
  DEPOSIT_USD_MINIMUM,
  DepositFeeShareSchema,
  DepositUsdSchema,
} from "./depositFeeShare";

const share = {
  depositUsd: 10_000,
  daysCounted: 26,
  daysUnmeasurable: 1,
  poolFeesUsd: 987_599.12,
  depositFeesUsd: 890.33,
  shareOfDeposit: 0.089033,
};

describe("DepositUsdSchema", () => {
  it.each([DEPOSIT_USD_MINIMUM, 1_000, 2_500.5, DEPOSIT_USD_MAXIMUM])("accepts %s", (value) => {
    expect(DepositUsdSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["nothing at all", 0],
    ["a negative sum", -1_000],
    ["less than a dollar", 0.5],
    ["more than the largest size", DEPOSIT_USD_MAXIMUM + 1],
    ["not a number", Number.NaN],
    ["unbounded", Number.POSITIVE_INFINITY],
  ])("rejects %s", (_label, value) => {
    expect(DepositUsdSchema.safeParse(value).success).toBe(false);
  });
});

describe("DepositFeeShareSchema", () => {
  it("accepts a figure of the shape the calculator produces", () => {
    expect(DepositFeeShareSchema.parse(share)).toEqual(share);
  });

  it("accepts a deposit that collected nothing, on a pool that charged nothing", () => {
    const quiet = { ...share, poolFeesUsd: 0, depositFeesUsd: 0, shareOfDeposit: 0 };

    expect(DepositFeeShareSchema.safeParse(quiet).success).toBe(true);
  });

  /*
   * The one invariant that would otherwise print a position collecting more than
   * the pool it sits in charged. Unreachable through the calculator, because a
   * share of the form `L / (A + L)` is below one — which is exactly why it is
   * checked here instead of trusted there.
   */
  it("rejects a deposit taking more than the pool charged", () => {
    const result = DepositFeeShareSchema.safeParse({
      ...share,
      depositFeesUsd: share.poolFeesUsd + 0.01,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "depositFeesUsd")).toBe(true);
  });

  it.each([
    ["no days counted", { daysCounted: 0 }],
    ["a fraction of a day", { daysCounted: 1.5 }],
    ["a negative count of unmeasurable days", { daysUnmeasurable: -1 }],
    ["a negative sum of fees", { poolFeesUsd: -1 }],
    ["a deposit outside the sizes it will publish", { depositUsd: 0 }],
    ["a share of the deposit below zero", { shareOfDeposit: -0.01 }],
    ["a field nobody declared", { annualised: 0.42 }],
  ])("rejects %s", (_label, overrides) => {
    expect(DepositFeeShareSchema.safeParse({ ...share, ...overrides }).success).toBe(false);
  });
});
