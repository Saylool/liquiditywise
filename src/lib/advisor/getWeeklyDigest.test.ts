import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SmartSnapshot } from "../analytics/smartHistory";

/*
 * What the weekly page reads: the kept series, through the digest's own
 * composition, and `null` for every way of having nothing to read.
 */

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  store: null as null | ReturnType<typeof import("../telegram/fakeStore").fakeStore>,
}));

vi.mock("../store/openStore", () => ({ openConfiguredStore: () => state.store }));

import { fakeStore } from "../telegram/fakeStore";
import { getWeeklyReading } from "./getWeeklyDigest";

const snapshot = (at: string, values: readonly [number, number]): SmartSnapshot => ({
  at,
  measured: 100,
  smart: 20,
  medianYearlyYield: 0.1,
  smartFrom: 0.2,
  pairs: [
    { pool: "0xa", pair: "USDC / WETH", feePpm: 500, positions: 6, valueUsd: values[0], lowerPrice: 1, upperPrice: 2, currentPrice: 1.5, yearlyYield: 0.3 },
    { pool: "0xb", pair: "WETH / USDT", feePpm: 3000, positions: 6, valueUsd: values[1], lowerPrice: 1, upperPrice: 2, currentPrice: 1.5, yearlyYield: 0.4 },
  ],
});

const SERIES_KEY = "liquiditywise:smart:base:series";

describe("the weekly page's read of the kept series", () => {
  beforeEach(() => {
    state.store = fakeStore();
  });

  it("is nothing where this deployment keeps no store", async () => {
    state.store = null;
    expect(await getWeeklyReading(8453)).toBeNull();
  });

  it("is nothing on a chain whose positions cannot be listed, whatever the store holds", async () => {
    state.store!.data.set("liquiditywise:smart:unichain:series", JSON.stringify([snapshot("2026-09-28T09:00:00.000Z", [60, 40]), snapshot("2026-10-05T06:00:00.000Z", [30, 70])]));
    expect(await getWeeklyReading(130)).toBeNull();
  });

  it("is nothing when the store did not answer, rather than a quiet week", async () => {
    state.store!.down = true;
    expect(await getWeeklyReading(8453)).toBeNull();
  });

  it("says there is nothing to compare yet where no series is kept, or an unreadable one", async () => {
    expect(await getWeeklyReading(8453)).toEqual({ status: "not-yet" });

    state.store!.data.set(SERIES_KEY, "not json");
    expect(await getWeeklyReading(8453)).toEqual({ status: "not-yet" });
  });

  it("reads the chain's own series, and composes the week the bot would send", async () => {
    state.store!.data.set(
      SERIES_KEY,
      JSON.stringify([snapshot("2026-09-28T09:00:00.000Z", [60, 40]), snapshot("2026-10-05T06:00:00.000Z", [30, 70])]),
    );

    const reading = await getWeeklyReading(8453);
    expect(reading?.status).toBe("moved");
    if (reading?.status !== "moved") return;
    expect(reading.window).toEqual({ from: "2026-09-28T09:00:00.000Z", to: "2026-10-05T06:00:00.000Z", days: 6.875 });
    expect(reading.digest.gaining.map(({ pool }) => pool)).toEqual(["0xb"]);
    expect(reading.topYields.map(({ pool }) => pool)).toEqual(["0xb", "0xa"]);

    /* Another chain's series is not Base's. */
    expect(await getWeeklyReading(1)).toEqual({ status: "not-yet" });
  });
});
