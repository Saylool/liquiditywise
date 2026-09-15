import { describe, expect, it } from "vitest";

import { HOOK_PERMISSION_FLAGS } from "../../schemas";
import { DYNAMIC_FEE_FLAG } from "./v4PoolAdapter";
import { normalizeV4PoolCard } from "./v4PoolCardAdapter";

const POOL_ID = `0x${"e5".repeat(32)}`;
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const NATIVE = `0x${"0".repeat(40)}`;

const hookWith = (...bits: readonly number[]) =>
  `0x${"a".repeat(36)}${bits.reduce((all, bit) => all | bit, 0).toString(16).padStart(4, "0")}`;

const rawToken = (id: string, symbol: string, decimals: string, derivedETH = "1") => ({
  id,
  symbol,
  name: symbol,
  decimals,
  derivedETH,
});

const raw = (overrides: Record<string, unknown> = {}) => ({
  id: POOL_ID,
  feeTier: "250",
  tickSpacing: "10",
  hooks: NATIVE,
  token0: rawToken(USDC, "USDC", "6", "0.0004"),
  token1: rawToken(WETH, "WETH", "18", "1"),
  ...overrides,
});

const card = (overrides: Record<string, unknown> = {}) => {
  const result = normalizeV4PoolCard(raw(overrides));
  if (result === null) throw new Error("expected a card");
  return result;
};

describe("normalizeV4PoolCard", () => {
  it("carries the whole pool, hook and fee mode included", () => {
    const { pool } = card({ hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) });

    expect(pool.protocolVersion).toBe("v4");
    expect(pool.id).toBe(POOL_ID);
    expect(pool.tickSpacing).toBe(10);
    expect(pool.fee).toEqual({ kind: "static", feePpm: 250 });
    expect(pool.hookAddress).toBe(hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP));
  });

  it("reads the prices in ether the list is ordered with", () => {
    expect(card().ethPrice).toEqual({ token0: 0.0004, token1: 1 });
  });

  it("accepts native ether as a currency", () => {
    const { pool } = card({ token0: rawToken(NATIVE, "ETH", "18") });

    expect(pool.token0.address).toBe(NATIVE);
  });

  it("reads a dynamic fee as a state rather than a number", () => {
    const { pool } = card({
      feeTier: String(DYNAMIC_FEE_FLAG),
      hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP),
    });

    expect(pool.fee).toEqual({ kind: "dynamic", currentFeePpm: null });
  });

  /* A missing price is not a zero price; the pool stays, its comparability goes. */
  it("carries no price rather than a zero one when the source's is unusable", () => {
    expect(card({ token1: rawToken(WETH, "WETH", "18", "not-a-number") }).ethPrice).toBeNull();
  });

  it("keeps a genuinely zero price, which a worthless token really has", () => {
    expect(card({ token1: rawToken(WETH, "WETH", "18", "0") }).ethPrice).toEqual({
      token0: 0.0004,
      token1: 0,
    });
  });

  /*
   * The same admission rules as the single-pool read, one of each kind. A pool
   * failing any of them leaves the list rather than taking it down.
   */
  it.each([
    ["an id that is an address rather than a PoolId", { id: `0x${"c".repeat(40)}` }],
    ["a dynamic fee with no hook to set it", { feeTier: String(DYNAMIC_FEE_FLAG) }],
    ["currencies the wrong way round", { token0: rawToken(WETH, "WETH", "18"), token1: rawToken(USDC, "USDC", "6") }],
    ["a symbol carrying a newline", { token0: rawToken(USDC, "US\nDC", "6") }],
    ["a tick spacing of zero", { tickSpacing: "0" }],
  ])("refuses %s", (_label, overrides) => {
    expect(normalizeV4PoolCard(raw(overrides))).toBeNull();
  });
});
