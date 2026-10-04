import { describe, expect, it } from "vitest";

import { DEPOSIT_USD_MAXIMUM, MAX_HORIZON_DAYS } from "../../schemas";
import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";
import {
  APPLICATION_RANGE_DEFAULTS,
  HORIZON_CHOICES,
  HORIZON_PARAMETER,
  MULTIPLIER_CHOICES,
  MULTIPLIER_PARAMETER,
  DEPOSIT_CHOICES,
  DEPOSIT_PARAMETER,
  LOWER_PARAMETER,
  UPPER_PARAMETER,
  GAS_PARAMETER,
  RECENTRE_GAS_CHOICES,
  RECENTRE_GAS_MAXIMUM_USD,
  carriedRecentreGas,
  readRequestedRecentreGas,
  recentreGasUsd,
  poolAnalysisHref,
  readRequestedCustomRange,
  readRequestedParameters,
  type RangeDefaults,
  v4PoolAnalysisHref,
} from "./requestedParameters";

/** A reader who set a preference: a week ahead, wide, and a large deposit. */
const preferred: RangeDefaults = {
  parameters: { horizonDays: 7, standardDeviationMultiplier: 3 },
  depositUsd: 1_000_000,
};

const read = (
  horizon?: string | string[],
  multiplier?: string | string[],
  deposit?: string | string[],
) => readRequestedParameters(horizon, multiplier, deposit);

describe("readRequestedParameters, beneath a preference", () => {
  it("opens at the preference when the URL names nothing", () => {
    expect(readRequestedParameters(undefined, undefined, undefined, preferred)).toEqual({
      parameters: preferred.parameters,
      depositUsd: preferred.depositUsd,
      fellBack: false,
    });
  });

  it("lets a link that names its own band win over the preference", () => {
    expect(readRequestedParameters("90", "1", "1000", preferred)).toEqual({
      parameters: { horizonDays: 90, standardDeviationMultiplier: 1 },
      depositUsd: 1_000,
      fellBack: false,
    });
  });

  it("falls back field by field, to the preference and not to the application", () => {
    const read = readRequestedParameters("90", undefined, undefined, preferred);

    expect(read.parameters).toEqual({ horizonDays: 90, standardDeviationMultiplier: 3 });
    expect(read.depositUsd).toBe(1_000_000);
    expect(read.fellBack).toBe(false);
  });

  it("falls to the preference, and says so, when a field is unreadable", () => {
    expect(readRequestedParameters("soon", "3", undefined, preferred)).toEqual({
      parameters: preferred.parameters,
      depositUsd: preferred.depositUsd,
      fellBack: true,
    });
  });

  it("uses the application's own defaults when no preference is passed", () => {
    expect(APPLICATION_RANGE_DEFAULTS).toEqual({
      parameters: DEFAULT_PRICE_BAND_PARAMETERS,
      depositUsd: DEFAULT_DEPOSIT_USD,
    });
    expect(readRequestedParameters(undefined, undefined, undefined)).toEqual(
      readRequestedParameters(undefined, undefined, undefined, APPLICATION_RANGE_DEFAULTS),
    );
  });
});

describe("readRequestedParameters", () => {
  it("uses the defaults when nothing was asked for", () => {
    expect(read()).toEqual({
      parameters: DEFAULT_PRICE_BAND_PARAMETERS,
      depositUsd: DEFAULT_DEPOSIT_USD,
      fellBack: false,
    });
  });

  it("takes both fields when both were asked for", () => {
    expect(read("90", "2", "100000")).toEqual({
      parameters: { horizonDays: 90, standardDeviationMultiplier: 2 },
      depositUsd: 100_000,
      fellBack: false,
    });
  });

  it("takes a fractional multiplier", () => {
    expect(read("30", "1.5").parameters.standardDeviationMultiplier).toBe(1.5);
  });

  it("ignores surrounding whitespace", () => {
    expect(read(" 90 ", " 2 ").parameters).toEqual({
      horizonDays: 90,
      standardDeviationMultiplier: 2,
    });
  });

  it("accepts every choice the interface offers", () => {
    for (const days of HORIZON_CHOICES) {
      for (const sigma of MULTIPLIER_CHOICES) {
        for (const usd of DEPOSIT_CHOICES) {
          expect(read(String(days), String(sigma), String(usd))).toEqual({
            parameters: { horizonDays: days, standardDeviationMultiplier: sigma },
            depositUsd: usd,
            fellBack: false,
          });
        }
      }
    }
  });

  /*
   * The interface offers three horizons; the schema accepts up to a year. A
   * value the calculator would accept is accepted whether or not there is a
   * button for it.
   */
  it("accepts a value the schema allows but no button offers", () => {
    expect(read("365", "0.5", "2500.5")).toEqual({
      parameters: { horizonDays: 365, standardDeviationMultiplier: 0.5 },
      depositUsd: 2500.5,
      fellBack: false,
    });
  });

  it.each([
    ["not a number", "thirty"],
    ["empty", ""],
    ["negative", "-30"],
    ["zero", "0"],
    ["fractional days", "30.5"],
    ["past the longest horizon", String(MAX_HORIZON_DAYS + 1)],
    ["written in exponent form", "3e1"],
    ["written with a comma", "1,5"],
  ])("falls back on a horizon that is %s", (_label, raw) => {
    const result = read(raw, "2");

    expect(result.parameters.horizonDays).toBe(DEFAULT_PRICE_BAND_PARAMETERS.horizonDays);
    expect(result.fellBack).toBe(true);
  });

  it.each([
    ["not a number", "two"],
    ["zero", "0"],
    ["negative", "-1"],
  ])("falls back on a multiplier that is %s", (_label, raw) => {
    const result = read("90", raw);

    expect(result.parameters.standardDeviationMultiplier).toBe(
      DEFAULT_PRICE_BAND_PARAMETERS.standardDeviationMultiplier,
    );
    expect(result.fellBack).toBe(true);
  });

  it.each([
    ["not a number", "lots"],
    ["zero", "0"],
    ["under a dollar", "0.5"],
    ["past the largest size", String(DEPOSIT_USD_MAXIMUM + 1)],
    ["negative", "-1000"],
    ["written in exponent form", "1e4"],
  ])("falls back on a deposit that is %s", (_label, raw) => {
    const result = read("90", "2", raw);

    expect(result.depositUsd).toBe(DEFAULT_DEPOSIT_USD);
    expect(result.fellBack).toBe(true);
    /* And only that field: the band it arrived beside is untouched. */
    expect(result.parameters).toEqual({ horizonDays: 90, standardDeviationMultiplier: 2 });
  });

  it("treats a repeated deposit parameter as unreadable rather than picking one", () => {
    const result = read("90", "2", ["1000", "1000000"]);

    expect(result.depositUsd).toBe(DEFAULT_DEPOSIT_USD);
    expect(result.fellBack).toBe(true);
  });

  /*
   * Per field, so one mistyped value does not throw away the other. A reader who
   * asked for a quarter and fumbled the multiplier still gets their quarter.
   */
  it("keeps the field that was readable", () => {
    const result = read("90", "nonsense");

    expect(result.parameters.horizonDays).toBe(90);
    expect(result.parameters.standardDeviationMultiplier).toBe(
      DEFAULT_PRICE_BAND_PARAMETERS.standardDeviationMultiplier,
    );
    expect(result.fellBack).toBe(true);
  });

  it("says nothing fell back when nothing was asked for and nothing was wrong", () => {
    expect(read(undefined, "2").fellBack).toBe(false);
  });

  /*
   * A repeated parameter arrives as an array. Picking one of its values would be
   * answering a question that was not asked.
   */
  it("treats a repeated parameter as unreadable rather than choosing one", () => {
    const result = read(["7", "90"], "2");

    expect(result.parameters.horizonDays).toBe(DEFAULT_PRICE_BAND_PARAMETERS.horizonDays);
    expect(result.fellBack).toBe(true);
  });
});

/*
 * The link between two pools of one pair. Its whole job is to carry the band,
 * because the panel it serves invites a reader to open the tier next door and
 * compare — and two pools read under two different bands are not comparable.
 */
describe("poolAnalysisHref", () => {
  const POOL = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";

  it("points at the analysis of the pool it was given", () => {
    const href = poolAnalysisHref(POOL, DEFAULT_PRICE_BAND_PARAMETERS);

    expect(href.startsWith("/pool?")).toBe(true);
    expect(new URL(href, "https://example.invalid").searchParams.get("address")).toBe(POOL);
  });

  it("carries the band that was in effect", () => {
    const href = poolAnalysisHref(POOL, { horizonDays: 90, standardDeviationMultiplier: 1.5 });
    const query = new URL(href, "https://example.invalid").searchParams;

    expect(query.get(HORIZON_PARAMETER)).toBe("90");
    expect(query.get(MULTIPLIER_PARAMETER)).toBe("1.5");
  });

  /*
   * The parameters it writes have to be the ones the page reads back, or a link
   * would silently land on the defaults.
   */
  it("round-trips through the reader that parses it", () => {
    const parameters = { horizonDays: 7, standardDeviationMultiplier: 3 };
    const query = new URL(
      poolAnalysisHref(POOL, parameters),
      "https://example.invalid",
    ).searchParams;

    const read = readRequestedParameters(
      query.get(HORIZON_PARAMETER) ?? undefined,
      query.get(MULTIPLIER_PARAMETER) ?? undefined,
      query.get(DEPOSIT_PARAMETER) ?? undefined,
    );

    expect(read.parameters).toEqual(parameters);
    expect(read.fellBack).toBe(false);
  });
});

describe("v4PoolAnalysisHref", () => {
  it("links to the v4 page by id, carrying the chosen band", () => {
    const id = `0x${"e5".repeat(32)}`;

    expect(v4PoolAnalysisHref(id, { horizonDays: 90, standardDeviationMultiplier: 1.5 })).toBe(
      `/v4?id=${id}&days=90&sigma=1.5`,
    );
  });
});

describe("poolComparisonHref", () => {
  it("carries the band and the deposit, always, so every tier is read on the reader's footing", async () => {
    const { poolComparisonHref } = await import("./requestedParameters");

    expect(poolComparisonHref("0xabc", { horizonDays: 90, standardDeviationMultiplier: 2 }, 250)).toBe(
      "/compare?address=0xabc&days=90&sigma=2&usd=250",
    );
  });
});

describe("readRequestedCustomRange", () => {
  it("reads two decimals, the lower below the upper, as the reader wrote them", () => {
    expect(readRequestedCustomRange("3000", "3600.5")).toEqual({
      status: "usable",
      lower: 3000,
      upper: 3600.5,
      written: { lower: "3000", upper: "3600.5" },
    });
  });

  it("keeps what was written, so a tiny price is not shown back with an exponent", () => {
    const range = readRequestedCustomRange(" 0.0000001 ", "0.0000002");

    expect(range).toMatchObject({ status: "usable", lower: 1e-7, written: { lower: "0.0000001", upper: "0.0000002" } });
  });

  it("is nothing asked when neither edge arrived, or both arrived blank", () => {
    expect(readRequestedCustomRange(undefined, undefined)).toEqual({ status: "none" });
    expect(readRequestedCustomRange("", "  ")).toEqual({ status: "none" });
  });

  it.each([
    ["only a lower edge", "3000", undefined],
    ["only an upper edge", undefined, "3600"],
    ["a blank upper edge", "3000", ""],
    ["a lower edge equal to the upper", "3000", "3000"],
    ["a lower edge above the upper", "3600", "3000"],
    ["a zero lower edge", "0", "3000"],
    ["two zero edges", "0", "0.0"],
    ["a negative edge", "-1", "3000"],
    ["an exponent", "3e3", "3600"],
    ["a thousands separator", "3,000", "3600"],
    ["a decimal comma", "3000", "3600,5"],
    ["a word", "cheap", "3600"],
    ["Infinity spelt out", "3000", "Infinity"],
    ["a number too large to be finite", "3000", "9".repeat(400)],
    ["a repeated edge", ["3000", "3100"], "3600"],
  ])("refuses %s, whole", (_, lower, upper) => {
    expect(readRequestedCustomRange(lower, upper)).toEqual({ status: "unusable" });
  });

  it("travels under names a URL bar reads plainly", () => {
    expect([LOWER_PARAMETER, UPPER_PARAMETER]).toEqual(["lower", "upper"]);
  });
});

describe("readRequestedRecentreGas", () => {
  it("reads a cost per re-centre as the reader wrote it", () => {
    expect(readRequestedRecentreGas(" 5.50 ")).toEqual({ status: "usable", usd: 5.5, written: "5.50" });
    expect(readRequestedRecentreGas("0")).toEqual({ status: "usable", usd: 0, written: "0" });
    expect(readRequestedRecentreGas(String(RECENTRE_GAS_MAXIMUM_USD))).toMatchObject({ status: "usable", usd: RECENTRE_GAS_MAXIMUM_USD });
  });

  it("is nothing asked when it did not arrive, or arrived blank", () => {
    expect(readRequestedRecentreGas(undefined)).toEqual({ status: "none" });
    expect(readRequestedRecentreGas("  ")).toEqual({ status: "none" });
  });

  it.each([
    ["a negative cost", "-1"],
    ["an exponent", "5e1"],
    ["a decimal comma", "5,5"],
    ["a word", "cheap"],
    ["more than the ceiling", String(RECENTRE_GAS_MAXIMUM_USD + 0.01)],
    ["a number too large to be finite", "9".repeat(400)],
    ["a repeated cost", ["1", "5"]],
  ])("refuses %s, whole", (_, raw) => {
    expect(readRequestedRecentreGas(raw)).toEqual({ status: "unusable" });
  });

  it("counts what was asked, and nothing when nothing usable was", () => {
    expect(recentreGasUsd({ status: "usable", usd: 7.5, written: "7.5" })).toBe(7.5);
    expect(recentreGasUsd({ status: "none" })).toBe(0);
    expect(recentreGasUsd({ status: "unusable" })).toBe(0);
  });

  /* Carried hidden by the page's other forms only when it counts something, and as written. */
  it("is carried as written, and only when it is a cost", () => {
    expect(carriedRecentreGas({ status: "usable", usd: 5, written: "5.0" })).toBe("5.0");
    expect(carriedRecentreGas({ status: "usable", usd: 0, written: "0" })).toBeUndefined();
    expect(carriedRecentreGas({ status: "unusable" })).toBeUndefined();
    expect(carriedRecentreGas({ status: "none" })).toBeUndefined();
  });

  it("offers nothing counted first, and travels under a name a URL bar reads plainly", () => {
    expect(RECENTRE_GAS_CHOICES[0]).toBe(0);
    expect(GAS_PARAMETER).toBe("gas");
  });
});
