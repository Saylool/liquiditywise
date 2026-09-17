import { describe, expect, it } from "vitest";

import { getDictionary } from "../i18n/dictionaries";
import { MULTIPLIER_CHOICES } from "./requestedParameters";
import { widthWord } from "./widthWords";

/* One word per offered width, in the reader's language, and none for a width nobody offered. */
describe("widthWord", () => {
  it("names each offered width, in order", () => {
    const en = getDictionary("en");

    expect(MULTIPLIER_CHOICES.map((value) => widthWord(value, en))).toEqual(["Tight", "Medium", "Wide", "Very wide"]);
  });

  it("speaks the reader's language", () => {
    expect(widthWord(3, getDictionary("tr"))).toBe("Çok geniş");
  });

  it("has no word for a width typed into the URL", () => {
    expect(widthWord(2.5, getDictionary("en"))).toBeNull();
  });
});
