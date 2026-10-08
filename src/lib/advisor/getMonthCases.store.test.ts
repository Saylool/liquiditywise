import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * What getMonthCases does with its cache and the store: keeps each
 * measurement, serves it for seven hours, puts the last one kept back after
 * a restart, and never measures anything for a page.
 */

vi.mock("server-only", () => ({}));
vi.mock("./getMostTraded", () => ({ getMostTraded: async () => ({ v3: null, v4: null }) }));
vi.mock("./getPoolRangeAnalysis", () => ({
  getPoolRangeAnalysis: async () => {
    throw new Error("the reader is mocked below; no analysis is ever asked for");
  },
}));

const state = vi.hoisted(() => ({
  store: null as null | ReturnType<typeof import("../telegram/fakeStore").fakeStore>,
  outcome: "measured" as "measured" | "unavailable",
  reads: 0,
  pending: [] as (() => void)[],
}));

vi.mock("../store/openStore", () => ({ openConfiguredStore: () => state.store }));

const measured = (at: string) => ({
  status: "measured" as const,
  chainId: 1 as const,
  measuredAt: at,
  poolsAsked: 3,
  cases: [],
});

vi.mock("./readMonthCases", () => ({
  readMonthCases: async () => {
    state.reads += 1;
    return state.outcome === "measured" ? measured(new Date().toISOString()) : { status: "unavailable", notice: "market-data-timed-out" };
  },
}));

import { fakeStore } from "../telegram/fakeStore";
import { keepCases, readLatestCases } from "./casesStore";
import { forgetMonthCases, getKeptMonthCases, getMonthCases, hydrateMonthCases, MONTH_CASES_TTL_MS, MONTH_CASES_WARM_EVERY_MS } from "./getMonthCases";

/** Lets what a read started in the background finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const measuredAt = (ageMs: number) => new Date(Date.now() - ageMs).toISOString();

beforeEach(() => {
  forgetMonthCases();
  Object.assign(state, { store: fakeStore(), outcome: "measured", reads: 0 });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the cases, kept", () => {
  it("are measured every six hours and good for seven, so a reader never waits on the read", () => {
    expect(MONTH_CASES_WARM_EVERY_MS).toBe(6 * 60 * 60 * 1000);
    expect(MONTH_CASES_TTL_MS).toBe(7 * 60 * 60 * 1000);
    expect(MONTH_CASES_TTL_MS).toBeGreaterThan(MONTH_CASES_WARM_EVERY_MS);
  });

  it("are read once, served from the cache after, and read anew only when asked to refresh", async () => {
    const first = await getMonthCases(1);
    const second = await getMonthCases(1);
    expect(state.reads).toBe(1);
    expect(second).toBe(first);

    const third = await getMonthCases(1, { refresh: true });
    expect(state.reads).toBe(2);
    expect(third).not.toBe(first);
  });

  it("are kept in the store once measured, under the chain's slug", async () => {
    const read = await getMonthCases(1);
    await settle();

    expect(await readLatestCases(state.store!, "ethereum")).toEqual(read);
  });

  it("are read anew once seven hours have passed", async () => {
    vi.useFakeTimers();
    await getMonthCases(1);
    vi.advanceTimersByTime(MONTH_CASES_TTL_MS - 1);
    await getMonthCases(1);
    expect(state.reads).toBe(1);

    vi.advanceTimersByTime(2);
    await getMonthCases(1);
    expect(state.reads).toBe(2);
  });

  it("give way to the kept measurement when a fresh read fails, while the kept one lasts", async () => {
    const kept = await getMonthCases(1);
    state.outcome = "unavailable";

    expect(await getMonthCases(1, { refresh: true })).toBe(kept);
    expect(state.reads).toBe(2);
  });

  it("report the failure itself when nothing kept is left to give way to", async () => {
    state.outcome = "unavailable";

    expect(await getMonthCases(1)).toEqual({ status: "unavailable", notice: "market-data-timed-out" });
    expect(await readLatestCases(state.store!, "ethereum")).toBeNull();
  });

  it("share one in-flight read between everyone who asks during it", async () => {
    const [a, b] = await Promise.all([getMonthCases(1, { refresh: true }), getMonthCases(1, { refresh: true })]);

    expect(a).toBe(b);
    expect(state.reads).toBe(1);
  });

  it("survive a store that is down: the measurement is served from memory and nothing throws", async () => {
    state.store!.down = true;

    expect((await getMonthCases(1)).status).toBe("measured");
    await settle();
    expect(state.store!.data.size).toBe(0);
  });
});

describe("the cases after a restart", () => {
  it("come back from the store while they are still good, so no reader waits on a new measurement", async () => {
    await keepCases(state.store!, "ethereum", measured(measuredAt(60 * 60 * 1000)));

    expect(await hydrateMonthCases(1)).toBe(true);
    const served = await getMonthCases(1);
    expect(served.status).toBe("measured");
    if (served.status === "measured") expect(served.measuredAt).toBe((await readLatestCases(state.store!, "ethereum"))!.measuredAt);
    expect(state.reads).toBe(0);
  });

  it("are not brought back once they have run out, nor from a clock ahead of this one, nor over a measurement already in hand", async () => {
    await keepCases(state.store!, "ethereum", measured(measuredAt(MONTH_CASES_TTL_MS + 1000)));
    expect(await hydrateMonthCases(1)).toBe(false);

    await keepCases(state.store!, "ethereum", measured(measuredAt(-60_000)));
    expect(await hydrateMonthCases(1)).toBe(false);

    await getMonthCases(1);
    await keepCases(state.store!, "ethereum", measured(measuredAt(1000)));
    expect(await hydrateMonthCases(1)).toBe(false);
  });

  it("are not brought back where there is no store, or it is down", async () => {
    await keepCases(state.store!, "ethereum", measured(measuredAt(1000)));
    state.store!.down = true;
    expect(await hydrateMonthCases(1)).toBe(false);

    state.store = null;
    expect(await hydrateMonthCases(1)).toBe(false);
  });
});

describe("what a page is shown", () => {
  it("is what is kept in memory, never a read", async () => {
    await getMonthCases(1);
    const reads = state.reads;

    expect((await getKeptMonthCases(1))?.status).toBe("measured");
    expect(state.reads).toBe(reads);
  });

  it("is what is kept in the store when memory is cold, still without a read", async () => {
    await keepCases(state.store!, "ethereum", measured(measuredAt(60 * 60 * 1000)));

    const shown = await getKeptMonthCases(1);
    expect(shown?.status).toBe("measured");
    expect(state.reads).toBe(0);
  });

  it("is nothing — not a read — when neither memory nor the store holds a measurement that is still good", async () => {
    expect(await getKeptMonthCases(1)).toBeNull();

    await keepCases(state.store!, "ethereum", measured(measuredAt(MONTH_CASES_TTL_MS + 1000)));
    expect(await getKeptMonthCases(1)).toBeNull();

    state.store = null;
    expect(await getKeptMonthCases(1)).toBeNull();
    expect(state.reads).toBe(0);
  });

  it("is nothing when the store is down and memory is cold, rather than an error", async () => {
    state.store!.down = true;

    expect(await getKeptMonthCases(1)).toBeNull();
  });
});
