import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../chains/chainEnvironment", () => ({ rpcUrlFor: () => undefined }));

const calls = vi.hoisted(() => ({
  v3: [] as { chainId: number; refresh: boolean | undefined }[],
  v4: [] as (boolean | undefined)[],
  reads: 0,
  v3Status: "listed" as "listed" | "unavailable",
}));

vi.mock("../uniswap/getEthereumV3PoolDays", () => ({
  getEthereumV3PoolDays: async (chainId: number, options?: { refresh?: boolean }) => {
    calls.v3.push({ chainId, refresh: options?.refresh });
    return { status: "unavailable", notice: "market-data-unavailable" };
  },
}));
vi.mock("../uniswap/getEthereumV4PoolDays", () => ({
  getEthereumV4PoolDays: async (options?: { refresh?: boolean }) => {
    calls.v4.push(options?.refresh);
    return { status: "unavailable", notice: "market-data-unavailable" };
  },
}));
vi.mock("./readMostTraded", () => ({
  readMostTraded: async (request: {
    chainId: number;
    readV3Days: () => Promise<unknown>;
    readV4Days: (() => Promise<unknown>) | null;
  }) => {
    calls.reads += 1;
    await request.readV3Days();
    if (request.readV4Days !== null) await request.readV4Days();
    const listed = { status: "listed", pools: [], fetchedAt: String(calls.reads) };
    return {
      v3: calls.v3Status === "listed" ? listed : { status: "unavailable", notice: "market-data-unavailable" },
      v4: request.chainId === 1 ? listed : null,
    };
  },
}));

beforeEach(async () => {
  calls.v3 = [];
  calls.v4 = [];
  calls.reads = 0;
  calls.v3Status = "listed";
  const { forgetMostTraded } = await import("./getMostTraded");
  forgetMostTraded();
});

describe("the most-traded figures kept for thirty minutes", () => {
  it("reads once per chain, and v4 on mainnet alone", async () => {
    const { getMostTraded } = await import("./getMostTraded");

    await getMostTraded(1);
    await getMostTraded(1);
    await getMostTraded(8453);

    expect(calls.reads).toBe(2);
    expect(calls.v3.map(({ chainId }) => chainId)).toEqual([1, 8453]);
    expect(calls.v4).toHaveLength(1);
  });

  it("reads anew, day tables included, when asked to refresh", async () => {
    const { getMostTraded } = await import("./getMostTraded");

    await getMostTraded(1);
    const refreshed = await getMostTraded(1, { refresh: true });
    const kept = await getMostTraded(1);

    expect(calls.reads).toBe(2);
    expect(calls.v3.map(({ refresh }) => refresh)).toEqual([false, true]);
    expect(calls.v4).toEqual([false, true]);
    expect(kept).toBe(refreshed);
  });

  it("keeps the old read when a refresh does not list", async () => {
    const { getMostTraded } = await import("./getMostTraded");

    const first = await getMostTraded(8453);
    calls.v3Status = "unavailable";
    const failed = await getMostTraded(8453, { refresh: true });
    const kept = await getMostTraded(8453);

    expect(failed.v3.status).toBe("unavailable");
    expect(kept).toBe(first);
  });

  it("does not keep a read in which a half failed", async () => {
    const { getMostTraded } = await import("./getMostTraded");

    calls.v3Status = "unavailable";
    await getMostTraded(1);
    calls.v3Status = "listed";
    await getMostTraded(1);

    expect(calls.reads).toBe(2);
  });

  it("reads again once thirty minutes have passed", async () => {
    vi.useFakeTimers({ now: 0 });
    try {
      const { getMostTraded } = await import("./getMostTraded");

      await getMostTraded(1);
      vi.setSystemTime(30 * 60 * 1000 - 1);
      await getMostTraded(1);
      expect(calls.reads).toBe(1);
      vi.setSystemTime(30 * 60 * 1000);
      await getMostTraded(1);
      expect(calls.reads).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
