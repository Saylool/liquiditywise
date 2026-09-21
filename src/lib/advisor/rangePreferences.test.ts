import { describe, expect, it } from "vitest";

import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";
import { parseRangePreferences, serializeRangePreferences } from "./rangePreferences";
import { APPLICATION_RANGE_DEFAULTS, type RangeDefaults } from "./requestedParameters";

const chosen: RangeDefaults = {
  parameters: { horizonDays: 7, standardDeviationMultiplier: 2 },
  depositUsd: 100_000,
};

describe("range preferences", () => {
  it("survive a round trip through the cookie", () => {
    expect(parseRangePreferences(serializeRangePreferences(chosen))).toEqual(chosen);
  });

  it("write three decimals with a colon between, in form order", () => {
    expect(serializeRangePreferences(chosen)).toBe("7:2:100000");
    expect(
      serializeRangePreferences({
        parameters: { horizonDays: 30, standardDeviationMultiplier: 1.5 },
        depositUsd: 1_000,
      }),
    ).toBe("30:1.5:1000");
  });

  it("are absent, not defaulted, when nothing was stored", () => {
    expect(parseRangePreferences(undefined)).toBeNull();
  });

  it("keep the fields that parse and fall to the application for the rest", () => {
    /* An edited cookie: the horizon is fine, the width is nonsense, the deposit is missing. */
    expect(parseRangePreferences("90:wide")).toEqual({
      parameters: { horizonDays: 90, standardDeviationMultiplier: DEFAULT_PRICE_BAND_PARAMETERS.standardDeviationMultiplier },
      depositUsd: DEFAULT_DEPOSIT_USD,
    });
  });

  it("fall to the application's defaults, not a smaller set, for an empty cookie", () => {
    expect(parseRangePreferences("")).toEqual(APPLICATION_RANGE_DEFAULTS);
  });

  it("refuse what the schema refuses, field by field", () => {
    /* A year and a day, a negative width, and a deposit past the maximum. */
    expect(parseRangePreferences("366:-1:1e12")).toEqual(APPLICATION_RANGE_DEFAULTS);
  });
});
