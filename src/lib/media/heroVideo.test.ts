import { describe, expect, it } from "vitest";

import { readConnection, shouldLoadHeroVideo } from "./heroVideo";

describe("whether a decoration is worth someone's data", () => {
  /*
   * The default has to be yes. `navigator.connection` is absent in Safari and
   * in Firefox, so reading "no answer" as "slow" would quietly take the
   * effect away from a large share of readers on perfectly good connections
   * — and nothing would ever report it, because it looks like it working.
   */
  it("loads it when the browser will not say anything about the connection", () => {
    expect(shouldLoadHeroVideo(undefined)).toBe(true);
    expect(shouldLoadHeroVideo({})).toBe(true);
  });

  it("loads it on a connection the browser calls fast", () => {
    expect(shouldLoadHeroVideo({ effectiveType: "4g", saveData: false })).toBe(true);
  });

  /* An explicit request, and the one signal that outranks everything else. */
  it("refuses it when the reader has asked to save data", () => {
    expect(shouldLoadHeroVideo({ saveData: true })).toBe(false);
    expect(shouldLoadHeroVideo({ saveData: true, effectiveType: "4g" })).toBe(false);
  });

  it("refuses it on the connections that would take most of a minute", () => {
    for (const effectiveType of ["slow-2g", "2g", "3g"]) {
      expect(shouldLoadHeroVideo({ effectiveType })).toBe(false);
    }
  });

  /*
   * An unknown label is not a slow one. The list of effective types can grow,
   * and a browser inventing a faster tier than 4g must not be treated as the
   * worst case by a set that has never heard of it.
   */
  it("loads it for a label it does not recognise", () => {
    expect(shouldLoadHeroVideo({ effectiveType: "5g" })).toBe(true);
    expect(shouldLoadHeroVideo({ effectiveType: "" })).toBe(true);
  });

  /* saveData false is an answer, not a missing one, and must not refuse. */
  it("loads it when data saving is explicitly off", () => {
    expect(shouldLoadHeroVideo({ saveData: false, effectiveType: "4g" })).toBe(true);
  });
});

describe("reading a connection the type system does not know about", () => {
  it("finds the two fields it uses", () => {
    expect(readConnection({ connection: { saveData: true, effectiveType: "3g", rtt: 300 } })).toEqual({
      saveData: true,
      effectiveType: "3g",
    });
  });

  /*
   * Every one of these is a browser without the API, and every one has to end
   * up as "no reading" rather than as a falsy value that reads like a slow
   * connection further down.
   */
  it("says nothing when the browser has no such thing", () => {
    for (const shape of [undefined, null, {}, { connection: null }, { connection: "fast" }]) {
      expect(readConnection(shape)).toBeUndefined();
    }
  });

  it("ignores fields of the wrong type rather than passing them on", () => {
    expect(readConnection({ connection: { saveData: "yes", effectiveType: 4 } })).toEqual({
      saveData: undefined,
      effectiveType: undefined,
    });
  });

  /* The two together: a junk reading must still leave the video playing. */
  it("keeps the video for a connection object it cannot read", () => {
    expect(shouldLoadHeroVideo(readConnection({ connection: { saveData: "yes" } }))).toBe(true);
    expect(shouldLoadHeroVideo(readConnection(undefined))).toBe(true);
  });
});
