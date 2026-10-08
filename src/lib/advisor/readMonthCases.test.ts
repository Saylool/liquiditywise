import { describe, expect, it } from "vitest";

import { caseAnalysis } from "../testing/monthCaseFixture";
import type { CaseCandidate } from "./monthCases";
import type { MostTradedPool } from "./mostTraded";
import type { MostTraded } from "./readMostTraded";
import { readMonthCases } from "./readMonthCases";

/*
 * The reader with every source handed in: which pools it asks about, in what
 * order, how many, and what it says when the list itself could not be read.
 */

const NOW = new Date("2026-10-07T09:40:00.000Z");
const token = (symbol: string, address: string) => ({ chainId: 1, symbol, decimals: 18, address });
const v3 = (n: number, volumeUsd: number, hookAltersSwaps = false): MostTradedPool => ({
  pool: {
    protocolVersion: "v3",
    chainId: 1,
    id: `0x${n.toString(16).padStart(40, "0")}`,
    token0: token("A", `0x${"1".repeat(40)}`),
    token1: token("B", `0x${"2".repeat(40)}`),
    feePpm: 500,
  },
  volumeUsd,
  feesUsd: null,
  daysCounted: 7,
  hookAltersSwaps,
});
const listed = (pools: readonly MostTradedPool[]): MostTraded => ({
  v3: { status: "listed", pools, fetchedAt: "2026-10-01T00:00:00.000Z" },
  v4: null,
});

/** Thirty closes: ten at the opening, then the rest at `to` times it. */
const stepTo = (to: number): readonly number[] => Array.from({ length: 30 }, (_, index) => (index < 10 ? 1 : to));

/** Pools whose month is whole, bar those named: `tooYoung` cannot open a month ago, `failing` throws. */
const sources = (
  pools: readonly MostTradedPool[],
  { tooYoung = [], failing = [], paths = {} }: { tooYoung?: readonly string[]; failing?: readonly string[]; paths?: Record<string, readonly number[]> } = {},
) => {
  const asked: CaseCandidate[] = [];
  return {
    asked,
    sources: {
      listPools: async () => listed(pools),
      analyse: async (candidate: CaseCandidate) => {
        asked.push(candidate);
        if (failing.includes(candidate.id)) throw new Error("gateway");
        return caseAnalysis({ id: candidate.id, days: tooYoung.includes(candidate.id) ? 45 : 61, path: paths[candidate.id] ?? [] });
      },
      now: () => NOW,
    },
  };
};

describe("reading a chain's cases", () => {
  it("asks about the week's pools busiest first and stamps the read with the clock it was handed", async () => {
    const { asked, sources: s } = sources([v3(1, 100), v3(2, 300), v3(3, 200)]);
    const read = await readMonthCases(1, s);

    expect(asked.map(({ id }) => id)).toEqual([v3(2, 0).pool.id, v3(3, 0).pool.id, v3(1, 0).pool.id]);
    expect(read.status).toBe("measured");
    if (read.status !== "measured") throw new Error("measured");
    expect(read.measuredAt).toBe("2026-10-07T09:40:00.000Z");
    expect(read.chainId).toBe(1);
    expect(read.poolsAsked).toBe(3);
    expect(read.cases).toHaveLength(3);
  });

  it("orders the cases best first, by the stated figure, whatever order the pools were read in", async () => {
    const pools = [v3(1, 300), v3(2, 200), v3(3, 100)];
    const { sources: s } = sources(pools, { paths: { [pools[0]!.pool.id]: stepTo(1.5), [pools[1]!.pool.id]: stepTo(1.02) } });
    const read = await readMonthCases(1, s);
    if (read.status !== "measured") throw new Error("measured");

    const results = read.cases.map((one) => one.resultVsHeldUsd);
    expect(results).toEqual([...results].sort((a, b) => b - a));
    /* The pool whose price left the range and stayed out ends worst, however much it traded. */
    expect(read.cases[read.cases.length - 1]!.pool.id).toBe(pools[0]!.pool.id);
  });

  it("stops reading once it has a dozen whole cases, and never shows more", async () => {
    const pools = Array.from({ length: 24 }, (_, index) => v3(index + 1, 1000 - index));
    const { asked, sources: s } = sources(pools);
    const read = await readMonthCases(1, s);
    if (read.status !== "measured") throw new Error("measured");

    expect(read.cases).toHaveLength(12);
    expect(asked).toHaveLength(12);
    expect(read.poolsAsked).toBe(12);
  });

  it("goes on into the list when a pool's month is not whole, and counts the pools it asked about", async () => {
    const pools = Array.from({ length: 15 }, (_, index) => v3(index + 1, 1000 - index));
    const young = pools.slice(0, 3).map(({ pool }) => pool.id);
    const { asked, sources: s } = sources(pools, { tooYoung: young });
    const read = await readMonthCases(1, s);
    if (read.status !== "measured") throw new Error("measured");

    expect(read.cases).toHaveLength(12);
    expect(read.cases.map((one) => one.pool.id)).not.toEqual(expect.arrayContaining(young));
    expect(asked).toHaveLength(15);
    expect(read.poolsAsked).toBe(15);
  });

  it("lets a pool whose analysis throws cost that pool and nothing else", async () => {
    const pools = [v3(1, 300), v3(2, 200), v3(3, 100)];
    const { sources: s } = sources(pools, { failing: [pools[1]!.pool.id] });
    const read = await readMonthCases(1, s);
    if (read.status !== "measured") throw new Error("measured");

    expect(read.cases.map((one) => one.pool.id).sort()).toEqual([pools[0]!.pool.id, pools[2]!.pool.id].sort());
    expect(read.poolsAsked).toBe(3);
  });

  it("does not spend reads on a pool whose hook may alter swaps", async () => {
    const { asked, sources: s } = sources([v3(1, 900, true), v3(2, 1)]);
    await readMonthCases(1, s);

    expect(asked.map(({ id }) => id)).toEqual([v3(2, 0).pool.id]);
  });

  it("measures an empty month when pools were read and none was whole, rather than calling it unavailable", async () => {
    const pools = [v3(1, 1), v3(2, 2)];
    const { sources: s } = sources(pools, { tooYoung: pools.map(({ pool }) => pool.id) });
    const read = await readMonthCases(1, s);

    expect(read).toMatchObject({ status: "measured", poolsAsked: 2, cases: [] });
  });

  it("is unavailable, with the list's own notice, when every half of the list failed", async () => {
    const read = await readMonthCases(1, {
      listPools: async () => ({ v3: { status: "unavailable", notice: "market-data-timed-out" }, v4: null }),
      analyse: async () => {
        throw new Error("never asked");
      },
      now: () => NOW,
    });

    expect(read).toEqual({ status: "unavailable", notice: "market-data-timed-out" });
  });

  it("is unavailable on a chain with no half to read", async () => {
    const read = await readMonthCases(1, {
      listPools: async () => ({ v3: null, v4: null }),
      analyse: async () => {
        throw new Error("never asked");
      },
      now: () => NOW,
    });

    expect(read).toEqual({ status: "unavailable", notice: "chain-data-not-configured" });
  });

  it("reads the half that answered when the other failed", async () => {
    const read = await readMonthCases(1, {
      listPools: async () => ({ ...listed([v3(1, 1)]), v4: { status: "unavailable", notice: "market-data-timed-out" } }),
      analyse: async (candidate) => caseAnalysis({ id: candidate.id }),
      now: () => NOW,
    });

    expect(read).toMatchObject({ status: "measured", poolsAsked: 1 });
    if (read.status === "measured") expect(read.cases).toHaveLength(1);
  });
});
