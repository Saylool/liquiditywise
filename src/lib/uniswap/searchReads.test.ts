import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../chains/chainEnvironment", () => ({
  v3SubgraphIdFor: (chainId: number) => `v3-${chainId}`,
  rpcUrlFor: (chainId: number) => `rpc-${chainId}`,
}));

const asked = vi.hoisted(() => ({ v3: 0, v3Days: 0, v4: 0, answer: { status: "success", data: "found" } as unknown }));

vi.mock("./ethereumV3PoolSearch", () => ({
  fetchEthereumV3PoolSearch: async () => {
    asked.v3 += 1;
    return asked.answer;
  },
  fetchV3PoolSearchFromDays: async () => {
    asked.v3Days += 1;
    return asked.answer;
  },
}));
vi.mock("./ethereumV4PoolSearch", () => ({
  fetchEthereumV4PoolSearch: async () => {
    asked.v4 += 1;
    return asked.answer;
  },
}));
vi.mock("./getEthereumV3PoolDays", () => ({ getEthereumV3PoolDays: async () => ({ status: "unavailable" }) }));
vi.mock("./getEthereumV4PoolDays", () => ({ getEthereumV4PoolDays: async () => ({ status: "unavailable" }) }));

import { forgetV3PoolSearch, getEthereumV3PoolSearch } from "./getEthereumV3PoolSearch";
import { forgetV4PoolSearch, getEthereumV4PoolSearch } from "./getEthereumV4PoolSearch";

beforeEach(() => {
  asked.v3 = 0;
  asked.v3Days = 0;
  asked.v4 = 0;
  asked.answer = { status: "success", data: "found" };
  forgetV3PoolSearch();
  forgetV4PoolSearch();
});

describe("a search kept for ten minutes", () => {
  it("answers the same terms on the same chain from what it kept, for v3 and v4 alike", async () => {
    await getEthereumV3PoolSearch(["usdc", "weth"]);
    const again = await getEthereumV3PoolSearch(["usdc", "weth"]);
    await getEthereumV4PoolSearch(["usdc", "weth"], 42161);
    await getEthereumV4PoolSearch(["usdc", "weth"], 42161);

    expect(again).toEqual({ status: "success", data: "found" });
    expect([asked.v3, asked.v4]).toEqual([1, 1]);
  });

  it("asks again for other terms, another order, another case or another chain", async () => {
    await getEthereumV3PoolSearch(["usdc", "weth"]);
    await getEthereumV3PoolSearch(["weth", "usdc"]);
    await getEthereumV3PoolSearch(["USDC", "weth"]);
    await getEthereumV3PoolSearch(["usdc"]);
    await getEthereumV3PoolSearch(["usdc", "weth"], 42161);
    await getEthereumV3PoolSearch(["usdc", "weth"], 8453);

    expect([asked.v3, asked.v3Days]).toEqual([5, 1]);
  });

  it("does not keep a search that failed", async () => {
    asked.answer = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
    await getEthereumV3PoolSearch(["usdc"]);
    await getEthereumV3PoolSearch(["usdc"]);
    await getEthereumV4PoolSearch(["usdc"]);
    await getEthereumV4PoolSearch(["usdc"]);

    expect([asked.v3, asked.v4]).toEqual([2, 2]);
  });
});
