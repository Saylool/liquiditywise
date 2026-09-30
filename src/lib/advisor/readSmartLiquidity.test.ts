import { describe, expect, it } from "vitest";

import type { DataResult, V3PoolMetadata } from "../../schemas";
import type { InRangePool, InRangePosition } from "../uniswap/ethereumV3InRangePositions";
import type { PoolPositionEarnings } from "../uniswap/ethereumV3PositionEarnings";
import type { MostTraded } from "./readMostTraded";
import { readSmartLiquidity, SMART_POOLS, type SmartLiquiditySources } from "./readSmartLiquidity";

const NOW = new Date("2026-09-30T12:00:00Z");
const NOW_SECONDS = NOW.getTime() / 1_000;
const DAY = 86_400;
const TICK = 198_080;

const poolOf = (index: number): V3PoolMetadata => ({
  protocolVersion: "v3",
  chainId: 1,
  id: `0x${index.toString(16).padStart(40, "0")}`,
  feePpm: 500,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
});

const listedPools = (count: number): MostTraded => ({
  v3: {
    status: "listed",
    fetchedAt: NOW.toISOString(),
    pools: Array.from({ length: count }, (_unused, index) => ({
      pool: poolOf(index + 1),
      volumeUsd: 1,
      feesUsd: 1,
      daysCounted: 7,
      hookAltersSwaps: false,
    })),
  },
  v4: null,
});

const position = (tokenId: string, liquidity = "10000000000000000"): InRangePosition => ({
  tokenId,
  liquidity,
  tickLower: TICK - 600,
  tickUpper: TICK + 600,
});

type Calls = { pools: string[]; dated: string[][]; earned: string[][] };

const sources = (overrides: Partial<SmartLiquiditySources> = {}, calls: Calls = { pools: [], dated: [], earned: [] }) => {
  const base: SmartLiquiditySources = {
    listPools: async () => listedPools(2),
    readPool: async (poolId) => {
      calls.pools.push(poolId);
      const pool = poolOf(Number.parseInt(poolId.slice(2), 16));
      const data: InRangePool = {
        pool,
        tick: TICK,
        usdPerToken0: 1,
        usdPerToken1: 1 / (1.0001 ** TICK * 1e-12),
        positions: [position(`${poolId}-old`), position(`${poolId}-new`), position(`${poolId}-dust`, "1000")],
      };
      return { status: "success", data };
    },
    readLastChanges: async (tokenIds) => {
      calls.dated.push([...tokenIds]);
      return {
        status: "success",
        data: new Map(tokenIds.map((id) => [id, NOW_SECONDS - (id.endsWith("-new") ? 1 : 10) * DAY])),
      };
    },
    readEarnings: async (_pool, positions): Promise<DataResult<PoolPositionEarnings>> => {
      calls.earned.push(positions.map(({ tokenId }) => tokenId));
      return {
        status: "success",
        data: {
          tick: TICK,
          positions: positions.map((listed) => ({
            ...listed,
            owner: `0x${"c".repeat(40)}`,
            fees0: "50000000",
            fees1: "0",
          })),
        },
      };
    },
    now: () => NOW,
  };
  return { sources: { ...base, ...overrides }, calls };
};

describe("reading the smart-money figures", () => {
  it("asks the chain only about positions big enough, and changed long enough ago", async () => {
    const { sources: s, calls } = sources();
    const result = await readSmartLiquidity(s);

    expect(calls.dated[0]).toEqual([`${poolOf(1).id}-old`, `${poolOf(1).id}-new`]);
    expect(calls.earned[0]).toEqual([`${poolOf(1).id}-old`]);
    expect(result).toMatchObject({ status: "measured", poolsAsked: 2, poolsRead: 2, measuredAt: NOW.toISOString() });
    expect(result.status === "measured" && result.data.measured).toBe(2);
  });

  it("looks into the week's most traded pools, no more than its limit", async () => {
    const { sources: s, calls } = sources({ listPools: async () => listedPools(SMART_POOLS + 4) });
    const result = await readSmartLiquidity(s);

    expect(calls.pools).toHaveLength(SMART_POOLS);
    expect(calls.pools[0]).toBe(poolOf(1).id);
    expect(result.status === "measured" && result.poolsAsked).toBe(SMART_POOLS);
  });

  it("counts a pool that could not be read as unread, and measures the rest", async () => {
    const failing = sources();
    const readPool = failing.sources.readPool;
    const { sources: s } = sources({
      readPool: async (poolId) =>
        poolId === poolOf(2).id ? { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } : readPool(poolId),
    });
    const noDates = sources({ readLastChanges: async () => ({ status: "unavailable", reason: "timeout", notice: "market-data-timed-out" }) });
    const noChain = sources({ readEarnings: async () => ({ status: "unavailable", reason: "timeout", notice: "chain-data-timed-out" }) });

    expect(await readSmartLiquidity(s)).toMatchObject({ status: "measured", poolsAsked: 2, poolsRead: 1 });
    expect(await readSmartLiquidity(noDates.sources)).toMatchObject({ status: "unavailable" });
    expect(await readSmartLiquidity(noChain.sources)).toMatchObject({ status: "unavailable" });
  });

  it("reads no chain for a pool with nothing big enough or old enough, and still counts it as read", async () => {
    const { sources: s, calls } = sources({
      readLastChanges: async (tokenIds) => ({ status: "success", data: new Map(tokenIds.map((id) => [id, NOW_SECONDS - DAY])) }),
    });
    const result = await readSmartLiquidity(s);

    expect(calls.earned).toEqual([]);
    expect(result).toMatchObject({ status: "measured", poolsRead: 2 });
    expect(result.status === "measured" && result.data.measured).toBe(0);
  });

  it("says why when the week's list could not be read, or v3 is not read at all", async () => {
    const unlisted = sources({ listPools: async () => ({ v3: { status: "unavailable", notice: "market-data-timed-out" }, v4: null }) });
    const noV3 = sources({ listPools: async () => ({ v3: null, v4: null }) });

    expect(await readSmartLiquidity(unlisted.sources)).toEqual({ status: "unavailable", notice: "market-data-timed-out" });
    expect(await readSmartLiquidity(noV3.sources)).toEqual({ status: "unavailable", notice: "market-data-not-configured" });
  });
});
