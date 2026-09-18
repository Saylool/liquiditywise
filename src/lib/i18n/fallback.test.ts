import { describe, expect, it } from "vitest";

import { withFallback } from "./fallback";

const complete = {
  heading: "Positions",
  nested: { title: "Range", body: "A long explanation.", deeper: { one: "1", two: "2" } },
  list: ["a", "b", "c"],
  greet: (name: string) => `Hello ${name}`,
};

describe("withFallback", () => {
  it("takes what is translated and English for the rest", () => {
    const merged = withFallback(complete, { heading: "Pozisyonlar" });

    expect(merged.heading).toBe("Pozisyonlar");
    expect(merged.nested.body).toBe("A long explanation.");
  });

  it("descends into objects rather than replacing them whole", () => {
    const merged = withFallback(complete, { nested: { title: "Aralık" } });

    expect(merged.nested.title).toBe("Aralık");
    /* The untranslated sibling has to survive; replacing the object would lose it. */
    expect(merged.nested.body).toBe("A long explanation.");
    expect(merged.nested.deeper.two).toBe("2");
  });

  it("descends as far as the object goes", () => {
    const merged = withFallback(complete, { nested: { deeper: { one: "bir" } } });

    expect(merged.nested.deeper).toEqual({ one: "bir", two: "2" });
  });

  /*
   * A function takes arguments and interpolates them, so half of one is not a
   * thing; an array's length carries meaning, so a partial one would silently
   * shorten it. Both are replaced whole or not at all.
   */
  it("replaces a function whole", () => {
    const merged = withFallback(complete, { greet: (name: string) => `Merhaba ${name}` });

    expect(merged.greet("Samet")).toBe("Merhaba Samet");
  });

  it("replaces a list whole rather than merging it item by item", () => {
    const merged = withFallback(complete, { list: ["x"] });

    expect(merged.list).toEqual(["x"]);
  });

  it("leaves the complete dictionary untouched", () => {
    withFallback(complete, { heading: "Pozisyonlar", nested: { title: "Aralık" } });

    expect(complete.heading).toBe("Positions");
    expect(complete.nested.title).toBe("Range");
  });

  it("changes nothing when nothing is translated", () => {
    expect(withFallback(complete, {})).toEqual(complete);
  });

  /*
   * An empty string is a translation — somebody wrote it — and an absent key is
   * not. The two must not be confused, which is why the merge tests for
   * `undefined` rather than for falsiness.
   */
  it("reads an empty string as a translation rather than as a gap", () => {
    expect(withFallback(complete, { heading: "" }).heading).toBe("");
  });

  /*
   * `exactOptionalPropertyTypes` forbids writing `undefined` into an optional
   * key, so no dictionary in this repository can reach the guard below. The
   * cast is deliberate: this merges data, and a function that merges data
   * should not fall over because a key arrived present and empty from
   * somewhere the compiler was not watching.
   */
  it("treats a key that is present and undefined as untranslated", () => {
    const partial = { heading: undefined } as unknown as Parameters<
      typeof withFallback<typeof complete>
    >[1];

    expect(withFallback(complete, partial).heading).toBe("Positions");
  });
});
