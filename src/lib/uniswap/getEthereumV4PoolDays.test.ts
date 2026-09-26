import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./ethereumSubgraphs", () => ({ ethereumSubgraphId: () => "v4-subgraph" }));

const answers = vi.hoisted(() => ({ queue: [] as unknown[], asked: 0 }));
vi.mock("./ethereumV4PoolDays", () => ({
  fetchEthereumV4PoolDays: async () => {
    answers.asked += 1;
    return { status: "success", data: { payload: answers.queue.shift(), fetchedAt: "2026-09-26T13:15:00.000Z" } };
  },
}));

beforeEach(async () => {
  answers.queue = [];
  answers.asked = 0;
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
    await getEthereumV4PoolDays({ refresh: true });
    const kept = await getEthereumV4PoolDays();

    expect(answers.asked).toBe(2);
    expect(payloadOf(kept)).toEqual({ data: { poolDayDatas: [{ date: 1 }] } });
  });

  it("keeps the old answer when a refresh comes back with errors", async () => {
    answers.queue = [{ data: { poolDayDatas: [] } }, { data: null, errors: [{ message: "bad indexers" }] }];
    const { getEthereumV4PoolDays } = await import("./getEthereumV4PoolDays");

    await getEthereumV4PoolDays();
    await getEthereumV4PoolDays({ refresh: true });
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
