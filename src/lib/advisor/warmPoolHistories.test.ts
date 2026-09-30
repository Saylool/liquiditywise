import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  lists: { v3: null, v4: null } as unknown,
  asked: [] as [string, string, number][],
  inFlight: 0,
  peak: 0,
  failing: new Set<string>(),
}));

vi.mock("./getMostTraded", () => ({ getMostTraded: async () => state.lists }));
vi.mock("../uniswap/getEthereumDailyPriceHistory", () => ({
  getEthereumDailyPriceHistory: async (protocol: string, id: string, chainId: number) => {
    state.asked.push([protocol, id, chainId]);
    state.inFlight += 1;
    state.peak = Math.max(state.peak, state.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    state.inFlight -= 1;
    return state.failing.has(id) ? { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } : { status: "success" };
  },
}));

import { CHAINS } from "../chains/chains";
import { warmPoolHistories } from "./warmPoolHistories";

const listed = (ids: string[]) => ({
  status: "listed",
  fetchedAt: "t",
  pools: ids.map((id) => ({ pool: { id } })),
});
const BASE = CHAINS[1];

beforeEach(() => {
  Object.assign(state, { lists: { v3: null, v4: null }, asked: [], inFlight: 0, peak: 0, failing: new Set() });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("warming the listed pools' histories", () => {
  it("reads every pool of both halves on the chain asked about, v3 first", async () => {
    state.lists = { v3: listed(["0xa", "0xb"]), v4: listed(["0xc"]) };
    const outcome = await warmPoolHistories(BASE);

    expect(state.asked).toEqual([
      ["v3", "0xa", 8453],
      ["v3", "0xb", 8453],
      ["v4", "0xc", 8453],
    ]);
    expect(outcome).toEqual({ asked: 3, read: 3 });
  });

  it("counts a pool that could not be read as asked and not read, and goes on", async () => {
    state.lists = { v3: listed(["0xa", "0xb", "0xc"]), v4: null };
    state.failing.add("0xb");

    expect(await warmPoolHistories(BASE)).toEqual({ asked: 3, read: 2 });
  });

  it("asks a few pools at once and no more", async () => {
    state.lists = { v3: listed(Array.from({ length: 10 }, (_unused, index) => `0x${index}`)), v4: null };
    await warmPoolHistories(BASE);

    expect(state.peak).toBe(3);
  });

  it("asks about nothing on a half that could not be listed or is not read", async () => {
    state.lists = { v3: { status: "unavailable", notice: "market-data-timed-out" }, v4: null };

    expect(await warmPoolHistories(BASE)).toEqual({ asked: 0, read: 0 });
    expect(state.asked).toEqual([]);
  });
});
