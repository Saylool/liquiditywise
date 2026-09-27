import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const asked = vi.hoisted(() => ({ chains: [] as unknown[] }));
vi.mock("../uniswap/getEthereumV4TradedPools", () => ({
  getEthereumV4TradedPools: async (chainId: unknown) => {
    asked.chains.push(chainId);
    return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
  },
}));

import { getHookDirectory } from "./getHookDirectory";

describe("the hook directory on a chain", () => {
  it("reads that chain's v4 net, mainnet's when not said, and says why when it cannot", async () => {
    const result = await getHookDirectory(8453);
    await getHookDirectory();

    expect(asked.chains).toEqual([8453, 1]);
    expect(result).toEqual({ status: "unavailable", notice: "market-data-timed-out" });
  });
});
