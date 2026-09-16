import { describe, expect, it } from "vitest";

import { HOOK_PERMISSION_FLAGS } from "../../schemas";
import { TRADED_POOL_LIMIT } from "./ethereumV3TradedPools";
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

/** The week's pool-days, busiest first; a pool appears once per day it traded. */
const payload = (pools: readonly unknown[], meta: unknown = { hasIndexingErrors: false }) => ({
  data: { poolDayDatas: pools.map((pool) => ({ pool })), poolManagers: [{ id: POOL_MANAGER }], _meta: meta },
});

const normalize = (body: unknown) => normalizeV4TradedPools({ payload: body, fetchedAt: FETCHED_AT });

describe("normalizeV4TradedPools", () => {
  it("keeps the source's order — busiest day first — and stamps the v4 source", () => {
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

  /* A pool that traded on several days of the week arrives once per day; its busiest day's place is the one it keeps. */
  it("lists a pool once however many days it traded, where its busiest day put it", () => {
    const result = normalize(payload([rawPool(2), rawPool(1), rawPool(2)]));

    expect(result.status === "success" && result.data.pools.map((pool) => pool.id)).toEqual([poolId(2), poolId(1)]);
  });

  /* Ids are folded before comparing, or two spellings of one pool would fail the list's own uniqueness rule. */
  it("lists a pool once when the source spells its id two ways", () => {
    const upper = { ...rawPool(0xabcdef), id: poolId(0xabcdef).toUpperCase().replace("0X", "0x") };
    const result = normalize(payload([rawPool(0xabcdef), upper]));

    expect(result.status).toBe("success");
    expect(result.status === "success" && result.data.pools).toHaveLength(1);
  });

  /* The same width as the v3 net, by construction: a thousand days fold into at most its limit of pools. */
  it("keeps at most the v3 net's width, the busiest days first", () => {
    const many = Array.from({ length: TRADED_POOL_LIMIT + 5 }, (_u, index) => rawPool(index + 1));
    const result = normalize(payload(many));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools).toHaveLength(TRADED_POOL_LIMIT);
    expect(result.data.pools.at(-1)?.id).toBe(poolId(TRADED_POOL_LIMIT));
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
