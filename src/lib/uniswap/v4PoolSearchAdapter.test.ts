import { describe, expect, it, vi } from "vitest";

import { HOOK_PERMISSION_FLAGS, type PoolSearchTerms, V4_POOL_SEARCH_RESULT_LIMIT } from "../../schemas";
import type { V4PoolState } from "./ethereumV4PoolState";
import type { V4PoolKey } from "./v4PoolKey";
import { hookedRefs, normalizeV4PoolSearch, readV4SearchPools } from "./v4PoolSearchAdapter";

const FETCHED_AT = "2026-09-15T14:00:00.000Z";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const NATIVE = `0x${"0".repeat(40)}`;

const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;

const hookWith = (...bits: readonly number[]) =>
  `0x${"a".repeat(36)}${bits.reduce((all, bit) => all | bit, 0).toString(16).padStart(4, "0")}`;

const rawToken = (id: string, symbol: string, decimals: string, derivedETH: string) => ({
  id,
  symbol,
  name: symbol,
  decimals,
  derivedETH,
});

const rawPool = ({
  id,
  symbols = ["USDC", "WETH"],
  hooks = NATIVE,
  feeTier = "250",
}: {
  id: number;
  symbols?: readonly [string, string];
  hooks?: string;
  feeTier?: string;
}) => ({
  id: poolId(id),
  createdAtBlockNumber: "21688329",
  feeTier,
  tickSpacing: "10",
  hooks,
  token0: rawToken(USDC, symbols[0], "6", "0.0004"),
  token1: rawToken(WETH, symbols[1], "18", "1"),
});

const payload = (
  forward: readonly unknown[],
  reverse: readonly unknown[] = [],
  poolManagers: readonly unknown[] = [{ id: POOL_MANAGER }],
) => ({ data: { forward, reverse, poolManagers, _meta: { hasIndexingErrors: false } } });

/** USDC per WETH ≈ 2500, as Q64.96 — the price every fixture pool sits at. */
const SQRT_PRICE = "1584563250285286751870879006";

const NO_CUT = { zeroForOnePpm: 0, oneForZeroPpm: 0 };

const statesFor = (liquidity: Record<number, string>): ReadonlyMap<string, V4PoolState> =>
  new Map(
    Object.entries(liquidity).map(([id, value]) => [
      poolId(Number(id)),
      { liquidity: value, sqrtPriceX96: SQRT_PRICE, lpFeePpm: 250, protocolFee: NO_CUT },
    ]),
  );

/** The key the chain would hold for a fixture pool: the pool's own fields, at this fee. */
const keyFor = (raw: ReturnType<typeof rawPool>, fee = 250): V4PoolKey => ({
  currency0: raw.token0.id,
  currency1: raw.token1.id,
  fee,
  tickSpacing: Number(raw.tickSpacing),
  hooks: raw.hooks,
});

const keysFor = (raws: readonly ReturnType<typeof rawPool>[]): ReadonlyMap<string, V4PoolKey> =>
  new Map(raws.map((raw) => [raw.id, keyFor(raw)]));

const normalize = (
  body: unknown,
  states: ReadonlyMap<string, V4PoolState> = new Map(),
  terms: PoolSearchTerms = ["usdc", "weth"],
  keys: ReadonlyMap<string, V4PoolKey> = new Map(),
) => normalizeV4PoolSearch({ payload: body, states, keys, terms, fetchedAt: FETCHED_AT });

const matchesOf = (result: ReturnType<typeof normalize>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  return result.data.matches;
};

describe("normalizeV4PoolSearch", () => {
  it("publishes the pools the source matched, with what the chain said about them", () => {
    const matches = matchesOf(normalize(payload([rawPool({ id: 1 })]), statesFor({ 1: "1000" })));

    expect(matches).toHaveLength(1);
    expect(matches[0]?.pool.id).toBe(poolId(1));
    expect(matches[0]?.state).toEqual({ liquidity: "1000", sqrtPriceX96: SQRT_PRICE });
    expect(matches[0]?.exactSymbolMatches).toBe(2);
  });

  /* The fee comes from the key the chain answered with, and from nowhere else. */
  it("takes each pool's fee from its key", () => {
    const raw = rawPool({ id: 1 });
    const matches = matchesOf(normalize(payload([raw]), statesFor({ 1: "1" }), ["usdc", "weth"], keysFor([raw])));

    expect(matches[0]?.pool.fee).toEqual({ kind: "static", feePpm: 250 });
    expect(matches[0]?.pool.protocolFee).toEqual(NO_CUT);
  });

  /* A hookless pool cannot be dynamic, so its stored fee is its key's: the state settles it. */
  it("reads a hookless pool's fee from its state when no key came back", () => {
    const matches = matchesOf(normalize(payload([rawPool({ id: 1 })]), statesFor({ 1: "1" })));

    expect(matches[0]?.pool.fee).toEqual({ kind: "static", feePpm: 250 });
  });

  it("marks a hooked pool's fee unread when no key came back", () => {
    const hooked = rawPool({ id: 1, hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) });
    const matches = matchesOf(normalize(payload([hooked]), statesFor({ 1: "1" })));

    expect(matches[0]?.pool.fee).toEqual({ kind: "unread" });
  });

  it("marks the fee unread when neither key nor state came back", () => {
    const matches = matchesOf(normalize(payload([rawPool({ id: 1 })])));

    expect(matches[0]?.pool.fee).toEqual({ kind: "unread" });
  });

  it("drops a pool whose key the indexer disagrees with", () => {
    const raw = rawPool({ id: 1 });
    const keys = new Map([[raw.id, { ...keyFor(raw), tickSpacing: 60 }]]);

    expect(matchesOf(normalize(payload([raw]), new Map(), ["usdc", "weth"], keys))).toEqual([]);
  });

  it("stamps the v4 source", () => {
    const result = normalize(payload([rawPool({ id: 1 })]));

    expect(result.status === "success" && result.data.source).toBe("uniswap-v4-subgraph");
  });

  /* A pool matching both terms arrives in both selections; it is published once. */
  it("merges the two selections without listing a pool twice", () => {
    const pool = rawPool({ id: 1 });
    const matches = matchesOf(normalize(payload([pool], [pool])));

    expect(matches).toHaveLength(1);
  });

  /*
   * The two copies are the same pool read the same way, and the first stands —
   * the rule the v3 adapter documents. Pinned with copies that differ in the one
   * field the source could plausibly change between two selections, so the rule
   * is tested rather than just described.
   */
  it("keeps the first copy of a pool that arrived twice", () => {
    const first = rawPool({ id: 1 });
    const second = { ...first, token1: rawToken(WETH, "WETH", "18", "2") };
    const matches = matchesOf(normalize(payload([first], [second])));

    expect(matches[0]?.ethPrice).toEqual({ token0: 0.0004, token1: 1 });
  });

  it("orders exact symbol matches first", () => {
    const matches = matchesOf(
      normalize(
        payload([rawPool({ id: 1, symbols: ["USDC", "aEthWETH"] }), rawPool({ id: 2 })]),
        statesFor({ 1: "9999", 2: "1" }),
      ),
    );

    expect(matches.map((match) => match.pool.id)).toEqual([poolId(2), poolId(1)]);
  });

  it("then orders by depth at the current price, deepest first", () => {
    const matches = matchesOf(
      normalize(
        payload([rawPool({ id: 1 }), rawPool({ id: 2 }), rawPool({ id: 3 })]),
        statesFor({ 1: "10", 2: "1000", 3: "100" }),
      ),
    );

    expect(matches.map((match) => match.pool.id)).toEqual([poolId(2), poolId(3), poolId(1)]);
  });

  /*
   * An unread pool is not an empty pool, and it does not get sorted as one.
   *
   * Run with the unread pool arriving first and arriving last. A two-element
   * sort calls the comparator in one orientation only, so a single fixture
   * reaches one of the two null branches and leaves the other unproven — which
   * a mutation of the unreached branch demonstrated.
   */
  it.each([
    ["arrives first", [rawPool({ id: 1 }), rawPool({ id: 2 })]],
    ["arrives last", [rawPool({ id: 2 }), rawPool({ id: 1 })]],
  ])("puts a pool the chain could not be read for last, behind an empty one, when it %s", (_label, forward) => {
    const matches = matchesOf(normalize(payload(forward), statesFor({ 2: "0" })));

    expect(matches.map((match) => match.pool.id)).toEqual([poolId(2), poolId(1)]);
    expect(matches[1]?.state).toBeNull();
  });

  it("breaks a tie by id, so two identical searches come back in one order", () => {
    const forward = [rawPool({ id: 3 }), rawPool({ id: 1 }), rawPool({ id: 2 })];
    const once = matchesOf(normalize(payload(forward), statesFor({ 1: "5", 2: "5", 3: "5" })));
    const again = matchesOf(normalize(payload([...forward].reverse()), statesFor({ 1: "5", 2: "5", 3: "5" })));

    expect(once.map((match) => match.pool.id)).toEqual(again.map((match) => match.pool.id));
  });

  it("carries a hooked pool through with its hook", () => {
    const hook = hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP, HOOK_PERMISSION_FLAGS.AFTER_SWAP);
    const matches = matchesOf(normalize(payload([rawPool({ id: 1, hooks: hook })])));

    expect(matches[0]?.pool.hookAddress).toBe(hook);
  });

  it("carries a pool trading native ether", () => {
    const native = { ...rawPool({ id: 1 }), token0: rawToken(NATIVE, "ETH", "18", "1") };
    const matches = matchesOf(normalize(payload([native]), new Map(), ["eth", "weth"]));

    expect(matches[0]?.pool.token0.address).toBe(NATIVE);
  });

  it("publishes at most the result limit", () => {
    const many = Array.from({ length: V4_POOL_SEARCH_RESULT_LIMIT * 2 }, (_u, index) =>
      rawPool({ id: index + 1 }),
    );

    expect(matchesOf(normalize(payload(many)))).toHaveLength(V4_POOL_SEARCH_RESULT_LIMIT);
  });

  /* One bad entry leaves the list; it does not take the list down. */
  it("drops a pool it cannot verify and says so, without naming it", () => {
    const onDiagnostic = vi.fn();
    const bad = { ...rawPool({ id: 2 }), tickSpacing: "0" };
    const result = normalizeV4PoolSearch({
      payload: payload([rawPool({ id: 1 }), bad]),
      states: new Map(),
      keys: new Map(),
      terms: ["usdc", "weth"],
      fetchedAt: FETCHED_AT,
      onDiagnostic,
    });

    expect(matchesOf(result)).toHaveLength(1);
    expect(onDiagnostic).toHaveBeenCalledWith("1 of 2 v4 pools unverifiable");
    expect(String(onDiagnostic.mock.calls[0])).not.toContain(poolId(2));
  });

  it("returns an empty list, which is a real answer, when nothing matched", () => {
    expect(matchesOf(normalize(payload([])))).toEqual([]);
  });

  it.each([
    ["a payload with errors", { ...payload([]), errors: [{ message: "nope" }] }],
    ["a payload with no data", { data: null }],
    ["something that is not a payload", "text"],
  ])("refuses %s as malformed", (_label, body) => {
    const result = normalize(body);

    expect(result.status === "unavailable" && result.notice).toBe("market-data-malformed");
  });

  it("refuses a source reporting indexing errors", () => {
    const result = normalize({
      data: { forward: [], reverse: [], poolManagers: [], _meta: { hasIndexingErrors: true } },
    });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-indexing-errors");
  });
});

describe("readV4SearchPools", () => {
  it("lists each pool once, with where it was created, and names the manager to ask about them", () => {
    const pool = rawPool({ id: 1 });
    const { pools, poolManager } = readV4SearchPools(payload([pool, rawPool({ id: 2 })], [pool]));

    expect(pools).toEqual([
      { id: poolId(1), createdAtBlockNumber: "21688329", hooked: false },
      { id: poolId(2), createdAtBlockNumber: "21688329", hooked: false },
    ]);
    expect(poolManager).toBe(POOL_MANAGER);
  });

  /* Whether a hook is attached decides whether the creation log has to be read at all. */
  it("says which pools are hooked, so only their logs are read", () => {
    const hooked = rawPool({ id: 3, hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) });
    const { pools } = readV4SearchPools(payload([hooked, rawPool({ id: 4 })]));

    expect(pools.map((pool) => pool.hooked)).toEqual([true, false]);
    expect(hookedRefs(pools)).toEqual([{ id: poolId(3), createdAtBlockNumber: "21688329" }]);
  });

  /* Only the id is checked here: a pool cannot be verified until the chain has answered for it. */
  it("leaves out an entry whose id is not a pool id", () => {
    const { pools } = readV4SearchPools(payload([{ ...rawPool({ id: 1 }), id: "0xnope" }]));

    expect(pools).toEqual([]);
  });

  /*
   * The manager's address decides whose storage the next request reads, so it
   * is validated rather than passed along.
   */
  it.each([
    ["no manager at all", []],
    ["a manager that is not an address", [{ id: "0x1234" }]],
  ])("names no manager for %s", (_label, poolManagers) => {
    const { poolManager } = readV4SearchPools(payload([rawPool({ id: 1 })], [], poolManagers));

    expect(poolManager).toBeNull();
  });

  it("answers with nothing for a payload it cannot read", () => {
    expect(readV4SearchPools("text")).toEqual({ pools: [], poolManager: null });
  });
});
