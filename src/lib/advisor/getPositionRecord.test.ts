import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/*
 * The four readers replaced, so what the boundary makes of their answers is
 * checked without a network: which was asked, with what, and what each
 * failure costs — the answer, or only the record.
 */
const chain = vi.hoisted(() => ({
  asked: [] as string[],
  position: "open" as "open" | "none" | "unavailable" | "throws",
  pools: "found" as "found" | "none" | "unavailable",
  fees: "read" as "read" | "unavailable",
  history: "read" as "read" | "unavailable",
}));

const XOR = "0x40fd72257597aa14c7231a7b1aaa29fce868f677";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";
const POOL = "0x7f63306a62c345365881e0fff85cb2c8baaa13d5";
const LIQUIDITY = "38349616863029655014582929927279522";

vi.mock("../chains/chainEnvironment", () => ({
  rpcUrlFor: () => "https://node.example.invalid/key",
  v3SubgraphIdFor: () => "v3-subgraph",
  v3PositionsSubgraphIdFor: () => "positions-subgraph",
}));
vi.mock("../uniswap/ethereumV3Position", () => ({
  fetchEthereumV3Position: async ({ tokenId, chainId }: { tokenId: string; chainId: number }) => {
    chain.asked.push(`position ${tokenId} on ${chainId}`);
    if (chain.position === "throws") throw new Error("https://node.example.invalid/key timed out");
    if (chain.position === "unavailable") return { status: "unavailable", reason: "timeout", notice: "chain-data-timed-out" };
    return {
      status: "success",
      data: {
        factory: FACTORY,
        position:
          chain.position === "none"
            ? null
            : {
                tokenId,
                token0: XOR,
                token1: WETH,
                feePpm: 10_000,
                tickLower: -414_400,
                tickUpper: 0,
                liquidity: LIQUIDITY,
                feeGrowthInside0Last: 0n,
                feeGrowthInside1Last: 0n,
                tokensOwed0: 0n,
                tokensOwed1: 0n,
              },
      },
    };
  },
}));
vi.mock("../uniswap/ethereumV3PoolsByIds", () => ({
  fetchEthereumV3PoolsByIds: async ({ poolAddresses, subgraphId }: { poolAddresses: string[]; subgraphId: string }) => {
    chain.asked.push(`pools ${poolAddresses.join(",")} from ${subgraphId}`);
    if (chain.pools === "unavailable") return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
    if (chain.pools === "none") return { status: "success", data: [] };
    return {
      status: "success",
      data: [
        {
          pool: {
            protocolVersion: "v3",
            chainId: 1,
            id: POOL,
            feePpm: 10_000,
            token0: { chainId: 1, address: XOR, symbol: "XOR", decimals: 18 },
            token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
          },
          tick: -200_000,
        },
      ],
    };
  },
}));
vi.mock("../uniswap/ethereumV3PositionFees", () => ({
  fetchEthereumV3PositionFees: async ({ positions }: { positions: { tokenId: string }[] }) => {
    chain.asked.push(`fees ${positions.map(({ tokenId }) => tokenId).join(",")}`);
    if (chain.fees === "unavailable") return { status: "unavailable", reason: "timeout", notice: "chain-data-timed-out" };
    return {
      status: "success",
      data: {
        fees: new Map([["1112391", { token0: "5", token1: "6" }]]),
        sqrtPrices: new Map([["1112391", BigInt(Math.round(1.0001 ** -100_000 * 2 ** 96))]]),
      },
    };
  },
}));
vi.mock("../uniswap/ethereumV3PositionSnapshots", () => ({
  fetchEthereumV3PositionHistories: async (tokenIds: string[], { subgraphId }: { subgraphId: string }) => {
    chain.asked.push(`history ${tokenIds.join(",")} from ${subgraphId}`);
    if (chain.history === "unavailable") return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
    return {
      status: "success",
      data: {
        asked: new Set(tokenIds),
        snapshots: new Map([
          [
            "1112391",
            [
              {
                blockNumber: 18_000_000n,
                at: "2023-08-01T00:00:00.000Z",
                liquidity: BigInt(LIQUIDITY),
                deposited0: 1_000_000,
                deposited1: 0,
                withdrawn0: 0,
                withdrawn1: 0,
                feeGrowthInside0: 0n,
                feeGrowthInside1: 0n,
              },
            ],
          ],
        ]),
        unreadable: new Set<string>(),
      },
    };
  },
}));

import { getPositionRecord } from "./getPositionRecord";

beforeEach(() => {
  chain.asked = [];
  chain.position = "open";
  chain.pools = "found";
  chain.fees = "read";
  chain.history = "read";
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("one position's record", () => {
  it("asks the manager for the position, then its pool, its fees and its history together, on the chain named", async () => {
    const read = await getPositionRecord("1112391", 1);

    expect(chain.asked).toEqual([
      "position 1112391 on 1",
      `pools ${POOL} from v3-subgraph`,
      "fees 1112391",
      "history 1112391 from positions-subgraph",
    ]);
    expect(read.status).toBe("found");
    if (read.status !== "found") return;
    expect(read.described.position.pool.id).toBe(POOL);
    expect(read.described.record.status).toBe("verified");
  });

  it("reads nothing more for an id that is no open position, and says there is none", async () => {
    chain.position = "none";

    expect(await getPositionRecord("7", 1)).toEqual({ status: "not-found" });
    expect(chain.asked).toEqual(["position 7 on 1"]);
  });

  it("says there is none when the source does not confirm the pool the position derives to", async () => {
    chain.pools = "none";

    expect(await getPositionRecord("1112391", 1)).toEqual({ status: "not-found" });
  });

  it("is unavailable when the chain or the pool's source could not be read", async () => {
    chain.position = "unavailable";
    expect(await getPositionRecord("1112391", 1)).toEqual({ status: "unavailable" });

    chain.position = "open";
    chain.pools = "unavailable";
    expect(await getPositionRecord("1112391", 1)).toEqual({ status: "unavailable" });
  });

  /* As on the holdings page: the fees and the history are additions, and losing one costs the record alone. */
  it("still answers the position, with its record unread, when the fees or the history could not be read", async () => {
    chain.fees = "unavailable";
    const withoutFees = await getPositionRecord("1112391", 1);
    chain.fees = "read";
    chain.history = "unavailable";
    const withoutHistory = await getPositionRecord("1112391", 1);

    for (const read of [withoutFees, withoutHistory]) {
      expect(read.status).toBe("found");
      if (read.status !== "found") return;
      expect(read.described.record).toEqual({ status: "unread" });
    }
  });

  /* What a thrown error carries can include a keyed URL: it is an unavailable read, not a fault. */
  it("turns a throw into an unavailable read", async () => {
    chain.position = "throws";

    expect(await getPositionRecord("1112391", 1)).toEqual({ status: "unavailable" });
  });
});
