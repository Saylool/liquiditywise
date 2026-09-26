import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Which reads an address page makes on each chain: that chain's endpoint and
 * subgraph for v3, its own week of pools for the holdings net, and no v4 off
 * mainnet at all.
 */

vi.mock("server-only", () => ({}));

const asked = vi.hoisted(() => ({
  positions: [] as Record<string, unknown>[],
  poolsByIds: [] as Record<string, unknown>[],
  v4Ids: 0,
  days: [] as number[],
  balances: [] as Record<string, unknown>[],
  tradedPools: 0,
}));
const unavailable = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } as const;

vi.mock("../uniswap/ethereumV3Positions", () => ({
  fetchEthereumV3Positions: async (request: Record<string, unknown>) => {
    asked.positions.push(request);
    return { status: "success", data: { factory: `0x${"f".repeat(40)}`, held: 0, read: 0, open: [], closed: 0 } };
  },
}));
vi.mock("../uniswap/ethereumV3PoolsByIds", () => ({
  fetchEthereumV3PoolsByIds: async (request: Record<string, unknown>) => {
    asked.poolsByIds.push(request);
    return { status: "success", data: [] };
  },
}));
vi.mock("../uniswap/ethereumV4PositionIds", () => ({
  fetchEthereumV4PositionIds: async () => {
    asked.v4Ids += 1;
    return unavailable;
  },
}));
vi.mock("../uniswap/getEthereumV3PoolDays", () => ({
  getEthereumV3PoolDays: async (chainId: number) => {
    asked.days.push(chainId);
    return unavailable;
  },
}));
vi.mock("../uniswap/getEthereumV3TradedPools", () => ({
  getEthereumV3TradedPools: async () => {
    asked.tradedPools += 1;
    return unavailable;
  },
}));
vi.mock("../uniswap/getEthereumV4TradedPools", () => ({ getEthereumV4TradedPools: async () => unavailable }));
vi.mock("../uniswap/ethereumBalances", () => ({
  fetchEthereumBalances: async (request: Record<string, unknown>) => {
    asked.balances.push(request);
    return unavailable;
  },
}));

const OWNER = `0x${"a".repeat(40)}`;

beforeEach(() => {
  vi.stubEnv("BASE_RPC_URL", "https://base.example");
  vi.stubEnv("UNISWAP_V3_BASE_SUBGRAPH_ID", "base-v3");
  vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
  vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
  asked.positions = [];
  asked.poolsByIds = [];
  asked.v4Ids = 0;
  asked.days = [];
  asked.balances = [];
  asked.tradedPools = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("an address's positions on a chain", () => {
  it("asks that chain's manager, endpoint and subgraph, and reads no v4", async () => {
    const { getAddressPositions } = await import("./getAddressPositions");

    const result = await getAddressPositions(OWNER, 8453);

    expect(asked.positions[0]).toMatchObject({ chainId: 8453, rpcUrl: "https://base.example" });
    expect(asked.poolsByIds[0]).toMatchObject({ chainId: 8453, subgraphId: "base-v3" });
    expect(asked.v4Ids).toBe(0);
    expect(result.status === "success" && result.data.unread).toEqual([]);
  });

  it("reads v4 beside v3 on mainnet", async () => {
    const { getAddressPositions } = await import("./getAddressPositions");

    await getAddressPositions(OWNER);

    expect(asked.positions[0]).toMatchObject({ chainId: 1, rpcUrl: "https://mainnet.example" });
    expect(asked.v4Ids).toBe(1);
  });
});

describe("an address's holdings on a chain", () => {
  it("casts the net from that chain's week, asks its endpoint, and asks for its ether by name", async () => {
    const { getAddressHoldings } = await import("./getAddressHoldings");

    await getAddressHoldings(OWNER, 8453);

    expect(asked.days).toEqual([8453]);
    expect(asked.tradedPools).toBe(0);
    expect(asked.balances[0]).toMatchObject({ rpcUrl: "https://base.example" });
    expect(asked.balances[0]?.tokenAddresses).toContain(`0x${"0".repeat(40)}`);
  });

  it("keeps mainnet's own net on mainnet", async () => {
    const { getAddressHoldings } = await import("./getAddressHoldings");

    await getAddressHoldings(OWNER);

    expect(asked.tradedPools).toBe(1);
    expect(asked.days).toEqual([]);
  });
});
