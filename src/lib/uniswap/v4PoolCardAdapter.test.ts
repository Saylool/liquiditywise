import { describe, expect, it } from "vitest";

import { HOOK_PERMISSION_FLAGS } from "../../schemas";
import { DYNAMIC_FEE_FLAG } from "./v4PoolAdapter";
import { normalizeV4PoolCard } from "./v4PoolCardAdapter";
import { UNREAD_CHAIN, type V4PoolChainReading } from "./v4PoolChainReading";

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
  createdAtBlockNumber: "21688329",
  tickSpacing: "10",
  hooks: NATIVE,
  token0: rawToken(USDC, "USDC", "6", "0.0004"),
  token1: rawToken(WETH, "WETH", "18", "1"),
  ...overrides,
});

/** What the chain says, made to agree with a raw pool. `fee` is the key's fee field, flag included. */
const chainFor = (pool: ReturnType<typeof raw>, fee = 250): V4PoolChainReading => ({
  key: {
    currency0: pool.token0.id,
    currency1: pool.token1.id,
    fee,
    tickSpacing: Number(pool.tickSpacing),
    hooks: pool.hooks,
  },
  fees: {
    lpFeePpm: fee === DYNAMIC_FEE_FLAG ? 0 : fee,
    protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 },
  },
});

const card = (overrides: Record<string, unknown> = {}, fee = 250) => {
  const pool = raw(overrides);
  const result = normalizeV4PoolCard(pool, chainFor(pool, fee));
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
    const { pool } = card({ hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) }, DYNAMIC_FEE_FLAG);

    expect(pool.fee).toEqual({ kind: "dynamic", currentFeePpm: null });
  });

  /* A listed pool the chain did not answer for is still listed, with its fee unread. */
  it("carries a pool whose key was not read, with the fee marked so", () => {
    const result = normalizeV4PoolCard(raw(), UNREAD_CHAIN);

    expect(result?.pool.fee).toEqual({ kind: "unread" });
    expect(result?.pool.protocolFee).toBeNull();
  });

  it("carries no price rather than a zero one when the source's is unusable", () => {
    expect(card({ token0: rawToken(USDC, "USDC", "6", "-1") }).ethPrice).toBeNull();
  });

  it("keeps a genuinely zero price, which a worthless token really has", () => {
    expect(card({ token0: rawToken(USDC, "USDC", "6", "0") }).ethPrice).toEqual({ token0: 0, token1: 1 });
  });

  it("refuses a pool the indexer and the key disagree about", () => {
    const pool = raw({ tickSpacing: "60" });

    expect(normalizeV4PoolCard(pool, chainFor(raw()))).toBeNull();
  });

  it("refuses a pool it cannot verify", () => {
    const pool = raw({ tickSpacing: "0" });

    expect(normalizeV4PoolCard(pool, chainFor(pool))).toBeNull();
  });
});
