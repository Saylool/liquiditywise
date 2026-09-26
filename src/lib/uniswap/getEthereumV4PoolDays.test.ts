import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../chains/chainEnvironment", () => ({ v4SubgraphIdFor: (chainId: number) => `v4-subgraph-${chainId}` }));

const answers = vi.hoisted(() => ({ queue: [] as unknown[], asked: 0, subgraphs: [] as unknown[] }));
vi.mock("./ethereumV4PoolDays", () => ({
  fetchEthereumV4PoolDays: async ({ subgraphId }: { subgraphId: unknown }) => {
    answers.asked += 1;
    answers.subgraphs.push(subgraphId);
    return { status: "success", data: { payload: answers.queue.shift(), fetchedAt: "2026-09-26T13:15:00.000Z" } };
  },
}));

beforeEach(async () => {
  answers.queue = [];
  answers.asked = 0;
  answers.subgraphs = [];
  const { forgetV4PoolDays } = await import("./getEthereumV4PoolDays");
  forgetV4PoolDays();
});

const payloadOf = (result: { status: string; data?: { payload: unknown } }) =>
  result.status === "success" ? result.data?.payload : null;

describe("the v4 day table kept for ten minutes", () => {
  it("keeps a clean answer", async () => {
    answers.queue = [{ data: { poolDayDatas: [] } }];
    const { getEthereumV4PoolDays } = await import("./getEthereumV4PoolDays");

    await getEthereumV4PoolDays();
    await getEthereumV4PoolDays();

    expect(answers.asked).toBe(1);
  });

  it("keeps one answer per chain, each asked of its own subgraph", async () => {
    answers.queue = [{ data: { poolDayDatas: [] } }, { data: { poolDayDatas: [{ date: 2 }] } }];
    const { getEthereumV4PoolDays } = await import("./getEthereumV4PoolDays");

    await getEthereumV4PoolDays(1);
    const arbitrum = await getEthereumV4PoolDays(42161);
    await getEthereumV4PoolDays(42161);

    expect(answers.asked).toBe(2);
    expect(answers.subgraphs).toEqual(["v4-subgraph-1", "v4-subgraph-42161"]);
    expect(payloadOf(arbitrum)).toEqual({ data: { poolDayDatas: [{ date: 2 }] } });
  });

  it("does not keep an answer the gateway sent with errors in it", async () => {
    answers.queue = [{ data: null, errors: [{ message: "bad indexers" }] }, { data: { poolDayDatas: [] } }];
    const { getEthereumV4PoolDays } = await import("./getEthereumV4PoolDays");

    await getEthereumV4PoolDays();
    await getEthereumV4PoolDays();

    expect(answers.asked).toBe(2);
  });

  it("reads anew when asked to refresh, and keeps the new answer", async () => {
    answers.queue = [{ data: { poolDayDatas: [] } }, { data: { poolDayDatas: [{ date: 1 }] } }];
    const { getEthereumV4PoolDays } = await import("./getEthereumV4PoolDays");

    await getEthereumV4PoolDays();
    await getEthereumV4PoolDays(1, { refresh: true });
    const kept = await getEthereumV4PoolDays();

    expect(answers.asked).toBe(2);
    expect(payloadOf(kept)).toEqual({ data: { poolDayDatas: [{ date: 1 }] } });
  });

  it("keeps the old answer when a refresh comes back with errors", async () => {
    answers.queue = [{ data: { poolDayDatas: [] } }, { data: null, errors: [{ message: "bad indexers" }] }];
    const { getEthereumV4PoolDays } = await import("./getEthereumV4PoolDays");

    await getEthereumV4PoolDays();
    await getEthereumV4PoolDays(1, { refresh: true });
    const kept = await getEthereumV4PoolDays();

    expect(answers.asked).toBe(2);
    expect(payloadOf(kept)).toEqual({ data: { poolDayDatas: [] } });
  });

  it("reads again once ten minutes have passed", async () => {
    vi.useFakeTimers({ now: 0 });
    try {
      answers.queue = [{ data: { poolDayDatas: [] } }, { data: { poolDayDatas: [] } }];
      const { getEthereumV4PoolDays } = await import("./getEthereumV4PoolDays");

      await getEthereumV4PoolDays();
      vi.setSystemTime(10 * 60 * 1000 - 1);
      await getEthereumV4PoolDays();
      expect(answers.asked).toBe(1);
      vi.setSystemTime(10 * 60 * 1000);
      await getEthereumV4PoolDays();
      expect(answers.asked).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
