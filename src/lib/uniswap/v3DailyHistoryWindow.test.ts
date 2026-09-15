import { describe, expect, it } from "vitest";

import { DAILY_HISTORY_DAYS, resolveDailyHistoryWindow } from "./v3DailyHistoryWindow";

const MS_PER_DAY = 86_400_000;

/**
 * The window's end is a fixed fact — the start of the current UTC day — so it
 * stays a literal. Its start is that end minus however many days the history
 * asks for, so it is derived: pinning a second literal would only record today's
 * value of a constant that is meant to change.
 */
const daysBefore = (iso: string, days: number) =>
  new Date(Date.parse(iso) - days * MS_PER_DAY).toISOString();

const START_OF_TODAY = "2026-08-20T00:00:00.000Z";

describe("resolveDailyHistoryWindow", () => {
  const window = resolveDailyHistoryWindow(new Date("2026-08-20T09:15:00.000Z"));

  it("covers every completed day the history asks for", () => {
    expect(DAILY_HISTORY_DAYS).toBe(121);
    expect(window.expectedTimestamps).toHaveLength(DAILY_HISTORY_DAYS);
  });

  it("ends at the start of the current UTC day, exclusively", () => {
    expect(window.rangeEndExclusive).toBe("2026-08-20T00:00:00.000Z");
  });

  it("starts exactly that many days before the current UTC day", () => {
    expect(window.rangeStart).toBe(daysBefore(START_OF_TODAY, DAILY_HISTORY_DAYS));
  });

  it("excludes the current, still-incomplete UTC day", () => {
    expect(window.expectedTimestamps).not.toContain("2026-08-20T00:00:00.000Z");
    expect(window.expectedTimestamps.at(-1)).toBe("2026-08-19T00:00:00.000Z");
  });

  it("lists every day-start in the window, ascending and unique", () => {
    expect(window.expectedTimestamps[0]).toBe(daysBefore(START_OF_TODAY, DAILY_HISTORY_DAYS));
    expect(new Set(window.expectedTimestamps).size).toBe(DAILY_HISTORY_DAYS);
    expect([...window.expectedTimestamps].sort()).toEqual([...window.expectedTimestamps]);
  });

  it("spaces the expected timestamps exactly one day apart", () => {
    const gaps = window.expectedTimestamps
      .slice(1)
      .map((timestamp, index) => Date.parse(timestamp) - Date.parse(window.expectedTimestamps[index] ?? ""));
    expect(new Set(gaps)).toEqual(new Set([MS_PER_DAY]));
  });

  it("exposes the same bounds as Unix seconds for the subgraph filter", () => {
    expect(window.rangeEndExclusiveUnixSeconds).toBe(1_787_184_000);
    expect(window.rangeStartUnixSeconds).toBe(
      1_787_184_000 - DAILY_HISTORY_DAYS * 86_400,
    );
    expect(window.rangeEndExclusiveUnixSeconds - window.rangeStartUnixSeconds).toBe(DAILY_HISTORY_DAYS * 86_400);
  });

  it.each([
    ["just after midnight", "2026-08-20T00:00:00.000Z"],
    ["mid-morning", "2026-08-20T09:15:00.000Z"],
    ["one millisecond before midnight", "2026-08-20T23:59:59.999Z"],
  ])("returns the same window anywhere within a UTC day (%s)", (_label, instant) => {
    expect(resolveDailyHistoryWindow(new Date(instant))).toEqual(window);
  });

  it("rolls forward exactly one day at the next UTC midnight", () => {
    const next = resolveDailyHistoryWindow(new Date("2026-08-21T00:00:00.000Z"));

    expect(next.rangeEndExclusive).toBe("2026-08-21T00:00:00.000Z");
    expect(next.rangeStart).toBe(daysBefore("2026-08-21T00:00:00.000Z", DAILY_HISTORY_DAYS));
  });

  it("does not depend on the host timezone", () => {
    // Same instant, expressed with an offset: the window must be identical.
    const withOffset = new Date("2026-08-20T11:15:00.000+02:00");
    expect(resolveDailyHistoryWindow(withOffset)).toEqual(window);
  });
});
