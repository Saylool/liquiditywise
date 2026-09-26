import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const answers = vi.hoisted(() => ({ queue: [] as unknown[], asked: 0 }));
vi.mock("./ethereumV3PoolDays", () => ({
  fetchEthereumV3PoolDays: async () => {
    answers.asked += 1;
    return { status: "success", data: { payload: answers.queue.shift(), fetchedAt: "2026-09-26T13:15:00.000Z" } };
  },
}));

beforeEach(async () => {
  answers.queue = [];
  answers.asked = 0;
  const { forgetV3PoolDays } = await import("./getEthereumV3PoolDays");
  forgetV3PoolDays();
});

describe("the day table kept for ten minutes", () => {
  it("does not keep an answer the gateway sent with errors in it", async () => {
    answers.queue = [{ data: null, errors: [{ message: "bad indexers" }] }, { data: { poolDayDatas: [] } }];
    const { getEthereumV3PoolDays } = await import("./getEthereumV3PoolDays");

    await getEthereumV3PoolDays(8453);
    const second = await getEthereumV3PoolDays(8453);

    expect(answers.asked).toBe(2);
    expect(second.status === "success" && second.data.payload).toEqual({ data: { poolDayDatas: [] } });
  });

  it("keeps a clean answer, once per chain", async () => {
    answers.queue = [{ data: { poolDayDatas: [] } }, { data: { poolDayDatas: [] } }];
    const { getEthereumV3PoolDays } = await import("./getEthereumV3PoolDays");

    await getEthereumV3PoolDays(8453);
    await getEthereumV3PoolDays(8453);
    await getEthereumV3PoolDays(42161);

    expect(answers.asked).toBe(2);
  });
});
