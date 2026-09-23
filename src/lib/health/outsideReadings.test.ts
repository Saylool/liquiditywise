import { describe, expect, it } from "vitest";

import { readOutsideReadings } from "./outsideReadings";
import { problemsFrom } from "./problems";

const from = (query: string) => readOutsideReadings(new URLSearchParams(query));

describe("readings that arrive from outside as text", () => {
  it("takes nothing from an empty query", () => {
    expect(from("")).toEqual({});
  });

  it("reads the numbers a shell computed", () => {
    expect(from("certificateDays=42&diskPercent=87")).toEqual({
      certificateDays: 42,
      diskPercent: 87,
    });
  });

  it("keeps a negative certificate, which is the expired one", () => {
    expect(from("certificateDays=-5").certificateDays).toBe(-5);
  });

  /*
   * The trap this file exists for. Every non-empty string is truthy in
   * JavaScript, "0" included, so a coerced boolean would call a Redis with no
   * append-only log durable — reporting nothing, which is exactly the answer
   * the reading was added to avoid.
   */
  it("reads a zero as not durable, not as a non-empty string", () => {
    expect(from("storeDurable=0").storeDurable).toBe(false);
    expect(from("storeDurable=1").storeDurable).toBe(true);
    expect(problemsFrom(from("storeDurable=0")).map((p) => p.id)).toEqual(["store-not-durable"]);
  });

  it("treats anything else as unmeasured rather than as false", () => {
    expect(from("storeDurable=yes").storeDurable).toBeUndefined();
    expect(from("storeDurable=").storeDurable).toBeUndefined();
  });

  /*
   * A monitor that answers with an error has failed at its job. One unusable
   * reading must not cost the operator the others, so a query that will not
   * parse yields no readings and the route still reports what it can see for
   * itself.
   */
  it("gives up the whole query rather than refusing to answer", () => {
    expect(from("diskPercent=three%20quarters")).toEqual({});
    expect(from("diskPercent=1000")).toEqual({});
  });

  it("reads the hours since the last backup, zero included", () => {
    expect(from("backupHours=30")).toEqual({ backupHours: 30 });
    expect(from("backupHours=0")).toEqual({ backupHours: 0 });
    expect(problemsFrom(from("backupHours=30")).map((p) => p.id)).toEqual(["backup-stale"]);
    expect(from("backupHours=-1")).toEqual({});
  });

  it("ignores parameters it was not given", () => {
    expect(from("diskPercent=50&unrelated=1")).toEqual({ diskPercent: 50 });
  });
});
