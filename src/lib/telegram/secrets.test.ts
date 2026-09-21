import { describe, expect, it } from "vitest";

import { sameSecret } from "./secrets";

describe("sameSecret", () => {
  it("accepts the configured secret and nothing else", () => {
    expect(sameSecret("s3cret-value", "s3cret-value")).toBe(true);
    expect(sameSecret("s3cret-valu", "s3cret-value")).toBe(false);
    expect(sameSecret("s3cret-valuee", "s3cret-value")).toBe(false);
    expect(sameSecret("S3cret-value", "s3cret-value")).toBe(false);
    expect(sameSecret("", "s3cret-value")).toBe(false);
  });

  it("never matches an empty configured secret, whatever is presented", () => {
    expect(sameSecret("", "")).toBe(false);
    expect(sameSecret("anything", "")).toBe(false);
  });

  it("treats a missing header as a mismatch", () => {
    expect(sameSecret(null, "s3cret-value")).toBe(false);
    expect(sameSecret(undefined, "s3cret-value")).toBe(false);
  });

  it("compares bytes, so a prefix wrapped around does not pass", () => {
    /* "abab" against "ab": the wrapped read would see "ab" twice. */
    expect(sameSecret("ab", "abab")).toBe(false);
    expect(sameSecret("abab", "ab")).toBe(false);
  });
});
