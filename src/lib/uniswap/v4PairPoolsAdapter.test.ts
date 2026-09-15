import { describe, expect, it, vi } from "vitest";

import type { V4PoolState } from "./ethereumV4PoolState";
import { normalizeV4PairPools, readV4PairPools } from "./v4PairPoolsAdapter";

const FETCHED_AT = "2026-09-15T12:00:00.000Z";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;
const SQRT_PRICE = "1584563250285286751870879006";

const rawToken = (id: string, symbol: string, decimals: string) => ({ id, symbol, name: symbol, decimals, derivedETH: "1" });
const rawPool = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: poolId(index),
  feeTier: "250",
  tickSpacing: "10",
  hooks: `0x${"0".repeat(40)}`,
  token0: rawToken(USDC, "USDC", "6"),
  token1: rawToken(WETH, "WETH", "18"),
  ...overrides,
});

const payload = (pools: readonly unknown[], poolManagers: readonly unknown[] = [{ id: POOL_MANAGER }]) => ({
  data: { pools, poolManagers, _meta: { hasIndexingErrors: false } },
});

const statesFor = (liquidity: Record<number, string>): ReadonlyMap<string, V4PoolState> =>
  new Map(Object.entries(liquidity).map(([id, value]) => [poolId(Number(id)), { liquidity: value, sqrtPriceX96: SQRT_PRICE }]));

const normalize = (body: unknown, states = statesFor({}), analysedPoolId: string | null = poolId(1)) =>
  normalizeV4PairPools({ payload: body, states, analysedPoolId, fetchedAt: FETCHED_AT });

const poolsOf = (result: ReturnType<typeof normalize>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  return result.data.pools;
};

describe("normalizeV4PairPools", () => {
  it("orders the pair's pools by depth, deepest first", () => {
    const pools = poolsOf(normalize(payload([rawPool(1), rawPool(2), rawPool(3)]), statesFor({ 1: "10", 2: "1000", 3: "100" })));

    expect(pools.map((entry) => entry.pool.id)).toEqual([poolId(2), poolId(3), poolId(1)]);
  });

  it("puts a pool the chain could not be read for last", () => {
    const pools = poolsOf(normalize(payload([rawPool(1), rawPool(2)]), statesFor({ 1: "0" })));

    expect(pools.map((entry) => entry.pool.id)).toEqual([poolId(1), poolId(2)]);
    expect(pools[1]?.state).toBeNull();
  });

  /* A pool arriving twice is published once, and the first copy stands. */
  it("keeps the first copy of a pool that arrived twice", () => {
    const second = { ...rawPool(1), token1: { ...rawToken(WETH, "WETH", "18"), derivedETH: "2" } };
    const pools = poolsOf(normalize(payload([rawPool(1), second])));

    expect(pools).toHaveLength(1);
    expect(pools[0]?.ethPrice).toEqual({ token0: 1, token1: 1 });
  });

  it("accepts no analysed pool, for a pair named from a v3 page", () => {
    const result = normalize(payload([rawPool(1)]), statesFor({}), null);

    expect(result.status === "success" && result.data.analysedPoolId).toBeNull();
  });

  it("returns an empty list, which is a real answer, when a v3 pair has no v4 pool", () => {
    expect(poolsOf(normalize(payload([]), statesFor({}), null))).toEqual([]);
  });

  it("refuses a list that leaves out the pool being read", () => {
    expect(normalize(payload([rawPool(2)]), statesFor({}), poolId(1)).status).toBe("unavailable");
  });

  it("drops a pool it cannot verify and says so, without naming it", () => {
    const onDiagnostic = vi.fn();
    const result = normalizeV4PairPools({
      payload: payload([rawPool(1), rawPool(2, { tickSpacing: "0" })]),
      states: statesFor({}),
      analysedPoolId: poolId(1),
      fetchedAt: FETCHED_AT,
      onDiagnostic,
    });

    expect(poolsOf(result)).toHaveLength(1);
    expect(onDiagnostic).toHaveBeenCalledWith("1 of 2 v4 pair pools unverifiable");
  });

  it("refuses a source reporting indexing errors", () => {
    const result = normalize({ data: { pools: [], poolManagers: [], _meta: { hasIndexingErrors: true } } }, statesFor({}), null);

    expect(result.status === "unavailable" && result.notice).toBe("market-data-indexing-errors");
  });

  it.each([
    ["errors beside data", { ...payload([]), errors: [{ message: "nope" }] }],
    ["no data", { data: null }],
    ["not a payload", "text"],
  ])("refuses %s as malformed", (_label, body) => {
    const result = normalize(body, statesFor({}), null);

    expect(result.status === "unavailable" && result.notice).toBe("market-data-malformed");
  });
});

describe("readV4PairPools", () => {
  it("lists each verified pool once and names the manager", () => {
    const { pools, poolManager } = readV4PairPools(payload([rawPool(1), rawPool(1), rawPool(2)]));

    expect(pools.map((pool) => pool.id)).toEqual([poolId(1), poolId(2)]);
    expect(poolManager).toBe(POOL_MANAGER);
  });

  it.each([
    ["no manager", []],
    ["a manager that is not an address", [{ id: "0x1234" }]],
  ])("names no manager for %s", (_label, poolManagers) => {
    expect(readV4PairPools(payload([rawPool(1)], poolManagers)).poolManager).toBeNull();
  });
});
