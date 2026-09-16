import { describe, expect, it } from "vitest";

import { HOOK_PERMISSION_FLAGS } from "../../schemas";
import { normalizeV4TradedPools } from "./v4TradedPoolsAdapter";

const FETCHED_AT = "2026-09-15T12:00:00.000Z";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const NATIVE = `0x${"0".repeat(40)}`;
const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;
const hookWith = (...bits: readonly number[]) =>
  `0x${"a".repeat(36)}${bits.reduce((all, bit) => all | bit, 0).toString(16).padStart(4, "0")}`;

const rawToken = (id: string, symbol: string, decimals: string) => ({ id, symbol, name: symbol, decimals, derivedETH: "1" });

const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";

const rawPool = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: poolId(index),
  createdAtBlockNumber: "21688329",
  tickSpacing: "10",
  hooks: NATIVE,
  token0: rawToken(NATIVE, "ETH", "18"),
  token1: rawToken(USDC, "USDC", "6"),
  ...overrides,
});

const payload = (pools: readonly unknown[], meta: unknown = { hasIndexingErrors: false }) => ({
  data: { pools, poolManagers: [{ id: POOL_MANAGER }], _meta: meta },
});

const normalize = (body: unknown) => normalizeV4TradedPools({ payload: body, fetchedAt: FETCHED_AT });

describe("normalizeV4TradedPools", () => {
  it("keeps the source's order and stamps the v4 source", () => {
    const result = normalize(payload([rawPool(2), rawPool(1)]));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools.map((pool) => pool.id)).toEqual([poolId(2), poolId(1)]);
    expect(result.data.source).toBe("uniswap-v4-subgraph");
  });

  it("carries the chain's own ether as a currency", () => {
    const result = normalize(payload([rawPool(1)]));

    expect(result.status === "success" && result.data.pools[0]?.token0.address).toBe(NATIVE);
  });

  /*
   * The chain is not asked for this list, so every fee is unread — and the
   * list carries what a later read needs: the manager, and each pool's block.
   */
  it("publishes every fee unread, with the manager and the creation blocks", () => {
    const result = normalize(payload([rawPool(1, { createdAtBlockNumber: "21700000" }), rawPool(2)]));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools.map((pool) => pool.fee)).toEqual([{ kind: "unread" }, { kind: "unread" }]);
    expect(result.data.poolManager).toBe(POOL_MANAGER);
    expect(result.data.createdAtBlockNumbers).toEqual({ [poolId(1)]: "21700000", [poolId(2)]: "21688329" });
  });

  it("carries a hooked pool whole, its fee unread like the rest", () => {
    const hook = hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP);
    const result = normalize(payload([rawPool(1, { hooks: hook })]));

    expect(result.status === "success" && result.data.pools[0]?.fee).toEqual({ kind: "unread" });
    expect(result.status === "success" && result.data.pools[0]?.hookAddress).toBe(hook);
  });

  it("drops a pool it cannot verify and keeps the rest", () => {
    const result = normalize(payload([rawPool(1, { tickSpacing: "0" }), rawPool(2)]));

    expect(result.status === "success" && result.data.pools.map((pool) => pool.id)).toEqual([poolId(2)]);
  });

  it("lists a pool once however many times it arrives", () => {
    const result = normalize(payload([rawPool(1), rawPool(1)]));

    expect(result.status === "success" && result.data.pools).toHaveLength(1);
  });

  it("refuses a list with nothing verifiable in it", () => {
    expect(normalize(payload([rawPool(1, { tickSpacing: "0" })])).status).toBe("unavailable");
  });

  it("refuses a source reporting indexing errors", () => {
    const result = normalize(payload([rawPool(1)], { hasIndexingErrors: true }));

    expect(result.status === "unavailable" && result.notice).toBe("market-data-indexing-errors");
  });

  it.each([
    ["errors beside data", { ...payload([rawPool(1)]), errors: [{ message: "nope" }] }],
    ["no data", { data: null }],
    ["not a payload", 42],
  ])("refuses %s as malformed", (_label, body) => {
    const result = normalize(body);

    expect(result.status === "unavailable" && result.notice).toBe("market-data-malformed");
  });
});
