import { describe, expect, it } from "vitest";

import { fakeStore } from "../telegram/fakeStore";
import { fixtureCase } from "../testing/monthCaseFixture";
import { CASES_LATEST_TTL_MS, keepCases, type MeasuredCases, readLatestCases } from "./casesStore";

/*
 * What is kept of a chain's cases, and how a read of it fails: a store that
 * did not answer, a key nobody wrote, a value that is not a measurement, each
 * answered with `null` and never with something that reads as a month.
 */

const measured = (): MeasuredCases => ({
  status: "measured",
  chainId: 1,
  measuredAt: "2026-10-07T09:40:00.000Z",
  poolsAsked: 14,
  cases: [fixtureCase(), fixtureCase({ protocol: "v4", hookAddress: null })],
});

describe("the cases kept in the store", () => {
  it("come back as they went in, under one key per chain, with a day and a bit to live", async () => {
    const store = fakeStore();
    const read = measured();

    expect(await keepCases(store, "ethereum", read)).toBe(true);
    expect([...store.data.keys()]).toEqual(["liquiditywise:cases:ethereum:latest"]);
    expect(await readLatestCases(store, "ethereum")).toEqual(read);
    expect(CASES_LATEST_TTL_MS).toBe(26 * 60 * 60 * 1000);
    expect(CASES_LATEST_TTL_MS).toBeGreaterThan(7 * 60 * 60 * 1000);
  });

  it("keep one chain apart from another", async () => {
    const store = fakeStore();
    await keepCases(store, "base", measured());

    expect(await readLatestCases(store, "ethereum")).toBeNull();
    expect(await readLatestCases(store, "base")).not.toBeNull();
  });

  it("answer null when nothing was kept, when the store is down, and when what is kept is not a measurement", async () => {
    const store = fakeStore();
    expect(await readLatestCases(store, "ethereum")).toBeNull();

    store.data.set("liquiditywise:cases:ethereum:latest", "not json");
    expect(await readLatestCases(store, "ethereum")).toBeNull();

    store.data.set("liquiditywise:cases:ethereum:latest", JSON.stringify({ status: "measured", cases: "none" }));
    expect(await readLatestCases(store, "ethereum")).toBeNull();

    store.data.set("liquiditywise:cases:ethereum:latest", JSON.stringify({ ...measured(), chainId: 99999 }));
    expect(await readLatestCases(store, "ethereum")).toBeNull();

    await keepCases(store, "ethereum", measured());
    store.down = true;
    expect(await readLatestCases(store, "ethereum")).toBeNull();
    expect(await keepCases(store, "ethereum", measured())).toBe(false);
  });

  it("refuse a case whose pool does not hold the pool invariants", async () => {
    const store = fakeStore();
    const read = measured();
    const [first] = read.cases;
    const swapped = { ...first!, pool: { ...first!.pool, token0: first!.pool.token1, token1: first!.pool.token0 } };
    store.data.set("liquiditywise:cases:ethereum:latest", JSON.stringify({ ...read, cases: [swapped] }));

    expect(await readLatestCases(store, "ethereum")).toBeNull();
  });
});
