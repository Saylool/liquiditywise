import { describe, expect, it } from "vitest";

import { MAX_HORIZON_DAYS } from "../../schemas";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";
import {
  HORIZON_CHOICES,
  HORIZON_PARAMETER,
  MULTIPLIER_CHOICES,
  MULTIPLIER_PARAMETER,
  poolAnalysisHref,
  readRequestedParameters,
  v4PoolAnalysisHref,
} from "./requestedParameters";

const read = (horizon?: string | string[], multiplier?: string | string[]) =>
  readRequestedParameters(horizon, multiplier);

describe("readRequestedParameters", () => {
  it("uses the defaults when nothing was asked for", () => {
    expect(read()).toEqual({ parameters: DEFAULT_PRICE_BAND_PARAMETERS, fellBack: false });
  });

  it("takes both fields when both were asked for", () => {
    expect(read("90", "2")).toEqual({
      parameters: { horizonDays: 90, standardDeviationMultiplier: 2 },
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
        expect(read(String(days), String(sigma))).toEqual({
          parameters: { horizonDays: days, standardDeviationMultiplier: sigma },
          fellBack: false,
        });
      }
    }
  });

  /*
   * The interface offers three horizons; the schema accepts up to a year. A
   * value the calculator would accept is accepted whether or not there is a
   * button for it.
   */
  it("accepts a value the schema allows but no button offers", () => {
    expect(read("365", "0.5")).toEqual({
      parameters: { horizonDays: 365, standardDeviationMultiplier: 0.5 },
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
