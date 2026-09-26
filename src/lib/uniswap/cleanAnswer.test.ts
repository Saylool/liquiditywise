import { describe, expect, it } from "vitest";

import { isCleanAnswer } from "./cleanAnswer";

describe("an answer worth keeping", () => {
  it("is data with nothing wrong beside it", () => {
    expect(isCleanAnswer({ data: { poolDayDatas: [], _meta: { hasIndexingErrors: false } } })).toBe(true);
    expect(isCleanAnswer({ data: { poolDayDatas: [] } })).toBe(true);
  });

  it("is not a 200 that carried the gateway's errors", () => {
    expect(isCleanAnswer({ data: null, errors: [{ message: "bad indexers" }] })).toBe(false);
    expect(isCleanAnswer({ data: { poolDayDatas: [] }, errors: [{ message: "partial" }] })).toBe(false);
  });

  it("is not one whose indexer reports errors of its own, nor one with no data", () => {
    expect(isCleanAnswer({ data: { _meta: { hasIndexingErrors: true } } })).toBe(false);
    expect(isCleanAnswer({})).toBe(false);
    expect(isCleanAnswer(null)).toBe(false);
    expect(isCleanAnswer("nope")).toBe(false);
  });

  it("keeps an answer whose errors list is empty", () => {
    expect(isCleanAnswer({ data: { x: 1 }, errors: [] })).toBe(true);
  });
});
