import { describe, expect, it } from "vitest";

import type { SmartSnapshot, SnapshotPair } from "../analytics/smartHistory";
import { DIGEST_RANGES, digestChainOf, digestWeekStart, isDigestDue, weeklyDigestOf } from "./weeklyDigest";

/* 2026-10-05 is a Monday. */
const MONDAY = "2026-10-05";

describe("the week a digest belongs to", () => {
  it("starts at eight UTC on Monday, whichever day of the week it is asked on", () => {
    const start = new Date(`${MONDAY}T08:00:00.000Z`);
    expect(digestWeekStart(new Date(`${MONDAY}T08:00:00.000Z`))).toEqual(start);
    expect(digestWeekStart(new Date(`${MONDAY}T23:59:59.000Z`))).toEqual(start);
    expect(digestWeekStart(new Date("2026-10-08T12:00:00.000Z"))).toEqual(start);
    expect(digestWeekStart(new Date("2026-10-11T23:00:00.000Z"))).toEqual(start);
  });

  it("is still this Monday's before eight, not the week before's", () => {
    expect(digestWeekStart(new Date(`${MONDAY}T07:59:00.000Z`))).toEqual(new Date(`${MONDAY}T08:00:00.000Z`));
  });

  it("crosses a month's end", () => {
    expect(digestWeekStart(new Date("2026-10-01T10:00:00.000Z"))).toEqual(new Date("2026-09-28T08:00:00.000Z"));
  });
});

describe("whether a chat is due its digest", () => {
  const at = (time: string) => new Date(time);

  it("is not before eight on Monday, and is from eight on", () => {
    expect(isDigestDue(null, at(`${MONDAY}T07:59:59.999Z`))).toBe(false);
    expect(isDigestDue(null, at(`${MONDAY}T08:00:00.000Z`))).toBe(true);
    expect(isDigestDue(null, at(`${MONDAY}T23:59:00.000Z`))).toBe(true);
  });

  it("is due when the last one went out the week before, and not once this week's has", () => {
    const now = at(`${MONDAY}T08:05:00.000Z`);
    expect(isDigestDue("2026-09-28T08:05:00.000Z", now)).toBe(true);
    expect(isDigestDue(`${MONDAY}T07:59:59.999Z`, now)).toBe(true);
    expect(isDigestDue(`${MONDAY}T08:00:00.000Z`, now)).toBe(false);
    expect(isDigestDue(`${MONDAY}T08:01:00.000Z`, at(`${MONDAY}T20:00:00.000Z`))).toBe(false);
  });

  it("is not due on any other day, even when this week's never went out", () => {
    for (const day of ["2026-10-04", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]) {
      expect(isDigestDue(null, at(`${day}T09:00:00.000Z`)), day).toBe(false);
      expect(isDigestDue("2026-09-28T08:00:00.000Z", at(`${day}T09:00:00.000Z`)), day).toBe(false);
    }
  });

  it("is due again the next Monday", () => {
    expect(isDigestDue(`${MONDAY}T08:00:00.000Z`, at("2026-10-12T08:00:00.000Z"))).toBe(true);
  });
});

describe("the chain a link's digest is about", () => {
  it("is the link's own where the smart money is measured there, and Ethereum otherwise", () => {
    expect(digestChainOf(undefined)).toBe(1);
    expect(digestChainOf(1)).toBe(1);
    expect(digestChainOf(8453)).toBe(8453);
    expect(digestChainOf(42161)).toBe(42161);
    /* Unichain: v4 only, so no positions are listed and no series is kept. */
    expect(digestChainOf(130)).toBe(1);
  });
});

const pair = (pool: string, valueUsd: number, lower: number, upper: number, positions = 6): SnapshotPair => ({
  pool,
  pair: "USDC / WETH",
  feePpm: 500,
  positions,
  valueUsd,
  lowerPrice: lower,
  upperPrice: upper,
  currentPrice: (lower + upper) / 2,
  yearlyYield: 0.2,
});

const snapshot = (at: string, pairs: readonly SnapshotPair[]): SmartSnapshot => ({
  at,
  measured: 100,
  smart: 20,
  medianYearlyYield: 0.1,
  smartFrom: 0.2,
  pairs: [...pairs],
});

const WEEK_AGO = "2026-09-28T09:00:00.000Z";
const LATEST = `${MONDAY}T06:00:00.000Z`;

describe("what the week's digest says", () => {
  it("says nothing until a day of measurements is kept", () => {
    expect(weeklyDigestOf([])).toBeNull();
    expect(weeklyDigestOf([snapshot(LATEST, [pair("0xa", 10, 1, 2)])])).toBeNull();
    expect(
      weeklyDigestOf([
        snapshot("2026-10-04T18:00:00.000Z", [pair("0xa", 50, 1, 2), pair("0xb", 50, 1, 2)]),
        snapshot(LATEST, [pair("0xa", 10, 3, 6), pair("0xb", 90, 1, 2)]),
      ]),
    ).toBeNull();
  });

  it("says nothing when no share and no range moved enough to name", () => {
    expect(
      weeklyDigestOf([
        snapshot(WEEK_AGO, [pair("0xa", 50, 1, 2), pair("0xb", 50, 1, 2)]),
        snapshot(LATEST, [pair("0xa", 50.5, 1.01, 2.01), pair("0xb", 49.5, 1, 2)]),
      ]),
    ).toBeNull();
  });

  it("names the pairs gaining and losing a share, as the trend does, over the days between", () => {
    const digest = weeklyDigestOf([
      snapshot(WEEK_AGO, [pair("0xa", 60, 1, 2), pair("0xb", 40, 1, 2)]),
      snapshot("2026-10-01T09:00:00.000Z", [pair("0xa", 50, 1, 2), pair("0xb", 50, 1, 2)]),
      snapshot(LATEST, [pair("0xa", 30, 1, 2), pair("0xb", 70, 1, 2)]),
    ]);

    expect(digest?.days).toBeCloseTo(6.875);
    expect(digest?.gaining).toEqual([{ pool: "0xb", pair: "USDC / WETH", feePpm: 500, from: 0.4, to: 0.7 }]);
    expect(digest?.losing).toEqual([{ pool: "0xa", pair: "USDC / WETH", feePpm: 500, from: 0.6, to: 0.3 }]);
    expect(digest?.ranges).toEqual([]);
  });

  it("names a range that moved as far as the alert needs, as prices then and now in the pool's direction", () => {
    const digest = weeklyDigestOf([
      snapshot(WEEK_AGO, [pair("0xa", 50, 0.0003, 0.0005), pair("0xb", 50, 1, 2)]),
      snapshot(LATEST, [pair("0xa", 50, 0.0004, 0.0006), pair("0xb", 50, 1.1, 2.1)]),
    ]);

    expect(digest?.ranges).toEqual([
      { pool: "0xa", pair: "USDC / WETH", feePpm: 500, then: [0.0003, 0.0005], now: [0.0004, 0.0006], currentPrice: 0.0005 },
    ]);
  });

  it("does not name the range of a median of too few positions, at either end of the week", () => {
    const moved = (before: number, after: number) =>
      weeklyDigestOf([
        snapshot(WEEK_AGO, [pair("0xa", 50, 1, 2, before), pair("0xb", 50, 1, 2)]),
        snapshot(LATEST, [pair("0xa", 50, 3, 6, after), pair("0xb", 50, 1, 2)]),
      ]);

    expect(moved(6, 6)?.ranges).toHaveLength(1);
    expect(moved(5, 5)?.ranges).toHaveLength(1);
    expect(moved(4, 6)).toBeNull();
    expect(moved(6, 4)).toBeNull();
  });

  it("does not name a pair that was not there at the start of the week", () => {
    expect(
      weeklyDigestOf([
        snapshot(WEEK_AGO, [pair("0xb", 50, 1, 2)]),
        snapshot(LATEST, [pair("0xa", 10, 3, 6), pair("0xb", 90, 1, 2)]),
      ])?.ranges,
    ).toEqual([]);
  });

  it(`names at most ${DIGEST_RANGES}, the farthest moves first`, () => {
    const pools = ["0x1", "0x2", "0x3", "0x4", "0x5"];
    const digest = weeklyDigestOf([
      snapshot(WEEK_AGO, pools.map((pool) => pair(pool, 20, 1, 2))),
      snapshot(LATEST, pools.map((pool, index) => pair(pool, 20, 1 + (index + 1) * 0.5, 2 + (index + 1) * 0.5))),
    ]);

    expect(digest?.ranges.map(({ pool }) => pool)).toEqual(["0x5", "0x4", "0x3"]);
  });
});
