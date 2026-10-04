import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Which reads an address page makes on each chain: that chain's endpoint and
 * subgraph for v3 and v4, its own week of pools for the holdings net, and its
 * own v4 net.
 */

vi.mock("server-only", () => ({}));

const asked = vi.hoisted(() => ({
  positions: [] as Record<string, unknown>[],
  poolsByIds: [] as Record<string, unknown>[],
  v4Ids: [] as Record<string, unknown>[],
  v4Positions: [] as Record<string, unknown>[],
  v4Traded: [] as unknown[],
  days: [] as number[],
  balances: [] as Record<string, unknown>[],
  tradedPools: 0,
  /* The open v3 positions the manager reports, and what the history read is asked and does. */
  v3Open: [] as { tokenId: string }[],
  histories: [] as { tokenIds: readonly string[]; source: Record<string, unknown> }[],
  historyThrows: false,
}));
const unavailable = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } as const;

vi.mock("../uniswap/ethereumV3Positions", () => ({
  fetchEthereumV3Positions: async (request: Record<string, unknown>) => {
    asked.positions.push(request);
    const open = asked.v3Open;
    return {
      status: "success",
      data: { factory: `0x${"f".repeat(40)}`, held: open.length, read: open.length, open, closed: 0 },
    };
  },
}));
vi.mock("../uniswap/ethereumV3PositionFees", () => ({
  fetchEthereumV3PositionFees: async () => ({ status: "success", data: { fees: new Map(), sqrtPrices: new Map() } }),
}));
vi.mock("../uniswap/ethereumV3PositionSnapshots", () => ({
  fetchEthereumV3PositionHistories: async (tokenIds: readonly string[], source: Record<string, unknown>) => {
    asked.histories.push({ tokenIds, source });
    if (asked.historyThrows) throw new Error("the gateway went away");
    return { status: "success", data: { asked: new Set(tokenIds), snapshots: new Map(), unreadable: new Set() } };
  },
}));
vi.mock("../uniswap/ethereumV3PoolsByIds", () => ({
  fetchEthereumV3PoolsByIds: async (request: Record<string, unknown>) => {
    asked.poolsByIds.push(request);
    return { status: "success", data: [] };
  },
}));
vi.mock("../uniswap/ethereumV4PositionIds", () => ({
  fetchEthereumV4PositionIds: async (request: Record<string, unknown>) => {
    asked.v4Ids.push(request);
    return { status: "success", data: ["7"] };
  },
}));
vi.mock("../uniswap/ethereumV4Positions", () => ({
  fetchEthereumV4Positions: async (request: Record<string, unknown>) => {
    asked.v4Positions.push(request);
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
vi.mock("../uniswap/getEthereumV4TradedPools", () => ({
  getEthereumV4TradedPools: async (chainId: unknown) => {
    asked.v4Traded.push(chainId);
    return unavailable;
  },
}));
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
  vi.stubEnv("UNISWAP_V4_BASE_SUBGRAPH_ID", "base-v4");
  vi.stubEnv("UNISWAP_V4_ETHEREUM_SUBGRAPH_ID", "mainnet-v4");
  vi.stubEnv("UNISWAP_V4_UNICHAIN_SUBGRAPH_ID", "unichain-v4");
  vi.stubEnv("UNICHAIN_RPC_URL", "https://unichain.example");
  vi.stubEnv("ETHEREUM_RPC_URL", "https://mainnet.example");
  vi.stubEnv("UNISWAP_V3_ETHEREUM_SUBGRAPH_ID", "mainnet-v3");
  vi.stubEnv("UNISWAP_V3_BASE_POSITIONS_SUBGRAPH_ID", "base-positions");
  asked.positions = [];
  asked.poolsByIds = [];
  asked.v4Ids = [];
  asked.v4Positions = [];
  asked.v4Traded = [];
  asked.days = [];
  asked.balances = [];
  asked.tradedPools = 0;
  asked.v3Open = [];
  asked.histories = [];
  asked.historyThrows = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("an address's positions on a chain", () => {
  it("asks that chain's managers, endpoint and subgraphs, for v3 and v4 both", async () => {
    const { getAddressPositions } = await import("./getAddressPositions");

    const result = await getAddressPositions(OWNER, 8453);

    expect(asked.positions[0]).toMatchObject({ chainId: 8453, rpcUrl: "https://base.example" });
    expect(asked.poolsByIds[0]).toMatchObject({ chainId: 8453, subgraphId: "base-v3" });
    expect(asked.v4Ids[0]).toMatchObject({ subgraphId: "base-v4" });
    expect(asked.v4Positions[0]).toMatchObject({ chainId: 8453, rpcUrl: "https://base.example", tokenIds: ["7"] });
    /* The v4 side failed, and is named unread rather than left out as not asked. */
    expect(result.status === "success" && result.data.unread).toEqual(["v4"]);
  });

  it("reads v4 beside v3 on mainnet", async () => {
    const { getAddressPositions } = await import("./getAddressPositions");

    await getAddressPositions(OWNER);

    expect(asked.positions[0]).toMatchObject({ chainId: 1, rpcUrl: "https://mainnet.example" });
    expect(asked.v4Ids[0]).toMatchObject({ subgraphId: "mainnet-v4" });
    expect(asked.v4Positions[0]).toMatchObject({ chainId: 1, rpcUrl: "https://mainnet.example" });
  });
});

/*
 * The histories behind each v3 position's record: asked for by the page that
 * shows them and by nothing else, of the chain's positions subgraph, for the
 * positions a page can show — and never at the cost of the list.
 */
describe("an address's v3 position histories", () => {
  const open = (count: number) => Array.from({ length: count }, (_unused, index) => ({ tokenId: String(index + 1) }));

  it("are asked of that chain's positions subgraph, for the first positions a page can show", async () => {
    asked.v3Open = open(14);
    const { getAddressPositions } = await import("./getAddressPositions");

    const result = await getAddressPositions(OWNER, 8453, { history: true });

    expect(asked.histories).toHaveLength(1);
    expect(asked.histories[0]?.tokenIds).toEqual(open(12).map(({ tokenId }) => tokenId));
    expect(asked.histories[0]?.source).toMatchObject({ chainId: 8453, subgraphId: "base-positions" });
    expect(result.status === "success" && result.records).toEqual(new Map());
  });

  it("are not asked for unless the caller asks, and the answer then carries no records", async () => {
    asked.v3Open = open(2);
    const { getAddressPositions } = await import("./getAddressPositions");

    const result = await getAddressPositions(OWNER, 8453);

    expect(asked.histories).toEqual([]);
    expect(result.status === "success" && "records" in result).toBe(false);
  });

  it("cost the records and nothing else when the read throws", async () => {
    asked.v3Open = open(2);
    asked.historyThrows = true;
    const { getAddressPositions } = await import("./getAddressPositions");

    const result = await getAddressPositions(OWNER, 8453, { history: true });

    expect(result.status).toBe("success");
    expect(result.status === "success" && result.data.open).toBe(2);
  });
});

describe("an address's holdings on a chain", () => {
  it("casts the net from that chain's week, asks its endpoint, and asks for its ether by name", async () => {
    const { getAddressHoldings } = await import("./getAddressHoldings");

    await getAddressHoldings(OWNER, 8453);

    expect(asked.days).toEqual([8453]);
    expect(asked.tradedPools).toBe(0);
    expect(asked.v4Traded).toEqual([8453]);
    expect(asked.balances[0]).toMatchObject({ rpcUrl: "https://base.example" });
    expect(asked.balances[0]?.tokenAddresses).toContain(`0x${"0".repeat(40)}`);
  });

  it("keeps mainnet's own net on mainnet", async () => {
    const { getAddressHoldings } = await import("./getAddressHoldings");

    await getAddressHoldings(OWNER);

    expect(asked.tradedPools).toBe(1);
    expect(asked.days).toEqual([]);
    expect(asked.v4Traded).toEqual([1]);
    expect(asked.balances[0]).toMatchObject({ rpcUrl: "https://mainnet.example" });
  });
});

describe("an address on a v4-only chain", () => {
  it("reads its v4 positions there and asks nothing of v3", async () => {
    const { getAddressPositions } = await import("./getAddressPositions");

    const result = await getAddressPositions(OWNER, 130);

    expect(asked.positions).toEqual([]);
    expect(asked.v4Ids[0]).toMatchObject({ subgraphId: "unichain-v4" });
    expect(asked.v4Positions[0]).toMatchObject({ chainId: 130, rpcUrl: "https://unichain.example" });
    /* Both halves unread: the v4 one failed, and it is v4's reason that is given. */
    expect(result).toEqual({ status: "unavailable", notice: "market-data-timed-out" });
  });

  it("casts only the v4 net there, and asks for the chain's ether by name", async () => {
    const { getAddressHoldings } = await import("./getAddressHoldings");

    await getAddressHoldings(OWNER, 130);

    expect(asked.days).toEqual([]);
    expect(asked.tradedPools).toBe(0);
    expect(asked.v4Traded).toEqual([130]);
  });
});
