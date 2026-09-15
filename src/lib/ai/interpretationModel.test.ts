import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERPRETATION_MODEL,
  INTERPRETATION_MAX_TOKENS,
  INTERPRETATION_MODELS,
  isInterpretationModel,
  resolveInterpretationModel,
} from "./interpretationModel";

describe("resolveInterpretationModel", () => {
  it("uses the configured model when it is one this application knows", () => {
    expect(resolveInterpretationModel("gpt-5.6-luna")).toBe("gpt-5.6-luna");
    expect(resolveInterpretationModel("gpt-6-astra")).toBe("gpt-6-astra");
  });

  it("falls back to the default when nothing is configured", () => {
    expect(resolveInterpretationModel(undefined)).toBe(DEFAULT_INTERPRETATION_MODEL);
    expect(resolveInterpretationModel("")).toBe(DEFAULT_INTERPRETATION_MODEL);
  });

  /*
   * Pinned to a name rather than compared against itself, which every other
   * assertion here does — and which is why this one is worth having.
   *
   * The fallback only does its job if it lands somewhere callable. The default
   * was `gpt-5.6-terra`, and this project's key is refused it with a 403: an
   * OpenAI project can be scoped to an explicit list of models, and this one
   * holds a single entry. A blank or mistyped setting would have produced the
   * outage the fallback exists to prevent, and nothing in this file would have
   * noticed, because every check here was written against the constant itself.
   *
   * Change this line only alongside a measurement that the new default answers.
   */
  it("defaults to a model this deployment has been measured to reach", () => {
    expect(DEFAULT_INTERPRETATION_MODEL).toBe("gpt-5.6-luna");
  });

  /*
   * A typo must not take the explanation away. It is the one part of the page
   * allowed to be missing, and the fallback is visible anyway — the page names
   * the model that wrote the text.
   */
  it.each(["gpt-5.6-tera", "gpt-4", "GPT-5.6-TERRA", "  gpt-5.6-terra  "])(
    "falls back rather than failing on %s",
    (configured) => {
      expect(resolveInterpretationModel(configured)).toBe(DEFAULT_INTERPRETATION_MODEL);
    },
  );

  it("refuses a value that is not a string", () => {
    expect(isInterpretationModel(null)).toBe(false);
    expect(isInterpretationModel(5)).toBe(false);
    // An inherited property is not an entry in the allowlist.
    expect(isInterpretationModel("toString")).toBe(false);
    expect(isInterpretationModel("constructor")).toBe(false);
  });
});

describe("the allowlist", () => {
  it("defaults to a model it actually contains", () => {
    expect(isInterpretationModel(DEFAULT_INTERPRETATION_MODEL)).toBe(true);
  });

  it("maps every name to itself, so the key is the wire value", () => {
    for (const [key, value] of Object.entries(INTERPRETATION_MODELS)) {
      expect(value).toBe(key);
    }
  });

  it("leaves enough room that a normal answer never hits the ceiling", () => {
    // Four sections of at most 700 characters is well under a thousand tokens.
    expect(INTERPRETATION_MAX_TOKENS).toBeGreaterThan(1000);
  });
});
