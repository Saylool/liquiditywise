import { describe, expect, it, vi } from "vitest";

import type { V4PoolState } from "./ethereumV4PoolState";
import type { V4PoolKey } from "./v4PoolKey";
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
  createdAtBlockNumber: "21688329",
  tickSpacing: "10",
  hooks: `0x${"0".repeat(40)}`,
  token0: rawToken(USDC, "USDC", "6"),
  token1: rawToken(WETH, "WETH", "18"),
  ...overrides,
});

const payload = (pools: readonly unknown[], poolManagers: readonly unknown[] = [{ id: POOL_MANAGER }]) => ({
  data: { pools, poolManagers, _meta: { hasIndexingErrors: false } },
});

const NO_CUT = { zeroForOnePpm: 0, oneForZeroPpm: 0 };

const statesFor = (liquidity: Record<number, string>): ReadonlyMap<string, V4PoolState> =>
  new Map(
    Object.entries(liquidity).map(([id, value]) => [
      poolId(Number(id)),
      { liquidity: value, sqrtPriceX96: SQRT_PRICE, lpFeePpm: 250, protocolFee: NO_CUT },
    ]),
  );

/** The key the chain would hold for a fixture pool. */
const keyFor = (raw: ReturnType<typeof rawPool>, fee = 250): V4PoolKey => ({
  currency0: raw.token0.id,
  currency1: raw.token1.id,
  fee,
  tickSpacing: Number(raw.tickSpacing),
  hooks: raw.hooks,
});

const normalize = (
  body: unknown,
  states = statesFor({}),
  analysedPoolId: string | null = poolId(1),
  keys: ReadonlyMap<string, V4PoolKey> = new Map(),
) => normalizeV4PairPools({ payload: body, states, keys, analysedPoolId, fetchedAt: FETCHED_AT });

const poolsOf = (result: ReturnType<typeof normalize>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  return result.data.pools;
};

describe("normalizeV4PairPools", () => {
  it("takes each pool's fee from its key, or from its state when it has no hook, or marks it unread", () => {
    const raw = rawPool(1);
    const pools = poolsOf(normalize(payload([raw, rawPool(2), rawPool(3)]), statesFor({ 1: "1", 2: "1" }), poolId(1), new Map([[raw.id, keyFor(raw)]])));

    expect(pools.find((entry) => entry.pool.id === poolId(1))?.pool.fee).toEqual({ kind: "static", feePpm: 250 });
    expect(pools.find((entry) => entry.pool.id === poolId(2))?.pool.fee).toEqual({ kind: "static", feePpm: 250 });
    expect(pools.find((entry) => entry.pool.id === poolId(3))?.pool.fee).toEqual({ kind: "unread" });
  });

  /* A key that says one fee beside a state that stores another is not one pool's, and the pool is refused. */
  it("drops a pool whose key and state disagree about the fee", () => {
    const raw = rawPool(1);
    const pools = poolsOf(normalize(payload([raw, rawPool(2)]), statesFor({ 1: "1", 2: "1" }), poolId(2), new Map([[raw.id, keyFor(raw, 500)]])));

    expect(pools.map((entry) => entry.pool.id)).toEqual([poolId(2)]);
  });

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
      keys: new Map(),
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
