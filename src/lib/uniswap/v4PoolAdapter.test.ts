import { describe, expect, it } from "vitest";

import { HOOK_PERMISSION_FLAGS } from "../../schemas";
import { DYNAMIC_FEE_FLAG, normalizeV4Pool } from "./v4PoolAdapter";

const POOL_ID = `0x${"e5".repeat(32)}`;
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const NATIVE = `0x${"0".repeat(40)}`;

/** A hook address carrying exactly the given permission bits, as v4 mines them. */
const hookWith = (...bits: readonly number[]) =>
  `0x${"a".repeat(36)}${bits.reduce((all, bit) => all | bit, 0).toString(16).padStart(4, "0")}`;

const rawToken = (id: string, symbol: string, decimals: string, name = symbol) => ({
  id,
  symbol,
  name,
  decimals,
});

const payload = (overrides: Record<string, unknown> = {}) => ({
  data: {
    pool: {
      id: POOL_ID,
      feeTier: "3000",
      tickSpacing: "60",
      hooks: NATIVE,
      token0: rawToken(USDC, "USDC", "6"),
      token1: rawToken(WETH, "WETH", "18"),
      ...overrides,
    },
    _meta: { hasIndexingErrors: false },
  },
});

const normalize = (body: unknown) => normalizeV4Pool({ payload: body, poolId: POOL_ID });

const succeeded = (result: ReturnType<typeof normalize>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  return result.data;
};

describe("normalizeV4Pool", () => {
  it("reads a pool with no hook", () => {
    const pool = succeeded(normalize(payload()));

    expect(pool.protocolVersion).toBe("v4");
    expect(pool.id).toBe(POOL_ID);
    expect(pool.tickSpacing).toBe(60);
    expect(pool.fee).toEqual({ kind: "static", feePpm: 3000 });
    // The zero address means "no hook" on the wire and null in the domain, so
    // the two can never be confused.
    expect(pool.hookAddress).toBeNull();
  });

  /*
   * v4 permits fees far below anything v3 could express: the busiest pool on
   * mainnet charges twelve parts per million, where v3's lowest tier is a
   * hundred.
   */
  it("reads a fee finer than v3 could express", () => {
    const pool = succeeded(normalize(payload({ feeTier: "12" })));

    expect(pool.fee).toEqual({ kind: "static", feePpm: 12 });
  });

  /*
   * The sentinel is a wire-format detail and stops at this boundary: nothing
   * above the adapter ever sees the number, only that the fee is decided per
   * swap. A dynamic pool needs a hook, which the domain schema enforces.
   */
  it("turns the dynamic-fee sentinel into a state, not a number", () => {
    const pool = succeeded(
      normalize(
        payload({
          feeTier: String(DYNAMIC_FEE_FLAG),
          hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP),
        }),
      ),
    );

    expect(pool.fee).toEqual({ kind: "dynamic", currentFeePpm: null });
    expect(JSON.stringify(pool)).not.toContain(String(DYNAMIC_FEE_FLAG));
  });

  /*
   * The zero address as a *currency* is not a dropped field: v4 lets a pool hold
   * the chain's own ether. This is why a v4 token goes through `TokenSchema` and
   * not the v3 one, which refuses it.
   */
  it("accepts native ether as a currency", () => {
    const pool = succeeded(
      normalize(payload({ token0: rawToken(NATIVE, "ETH", "18") })),
    );

    expect(pool.token0.address).toBe(NATIVE);
    expect(pool.token0.symbol).toBe("ETH");
  });

  it("carries a hook address through as it is", () => {
    const hook = hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP, HOOK_PERMISSION_FLAGS.AFTER_SWAP);
    const pool = succeeded(normalize(payload({ hooks: hook })));

    expect(pool.hookAddress).toBe(hook);
  });

  /*
   * `Hooks.isValidHookAddress`: no hook means nobody could set the fee, so a
   * dynamic pool without one cannot exist on chain and must not be published as
   * though it did.
   */
  it("refuses a dynamic fee with no hook to set it", () => {
    expect(normalize(payload({ feeTier: String(DYNAMIC_FEE_FLAG) })).status).toBe("unavailable");
  });

  /*
   * The other half of the same rule: a returns-delta permission without the
   * callback it modifies is an orphan the protocol rejects outright.
   */
  it("refuses a returns-delta permission with no callback under it", () => {
    const orphan = hookWith(HOOK_PERMISSION_FLAGS.AFTER_SWAP_RETURNS_DELTA);

    expect(normalize(payload({ hooks: orphan })).status).toBe("unavailable");
  });

  it("reports a pool the source has never heard of", () => {
    const result = normalize({ data: { pool: null, _meta: { hasIndexingErrors: false } } });

    expect(result.status === "unavailable" && result.notice).toBe("pool-not-found");
  });

  it.each([
    ["currencies the wrong way round", { token0: rawToken(WETH, "WETH", "18"), token1: rawToken(USDC, "USDC", "6") }],
    ["a fee above what a PoolKey can hold", { feeTier: "1000001" }],
    ["a tick spacing past int16", { tickSpacing: "32768" }],
    ["a tick spacing of zero", { tickSpacing: "0" }],
    ["decimals that are not a number", { token0: rawToken(USDC, "USDC", "six") }],
    ["a symbol carrying a newline", { token0: rawToken(USDC, "US\nDC", "6") }],
  ])("refuses %s", (_label, overrides) => {
    expect(normalize(payload(overrides)).status).toBe("unavailable");
  });

  it.each([
    ["a body that is not the expected shape", { data: { pool: "none" } }],
    ["a response carrying errors beside data", { ...payload(), errors: [{ message: "x" }] }],
    ["a response with no data", { data: null }],
    [
      "a source reporting indexing errors",
      { data: { pool: payload().data.pool, _meta: { hasIndexingErrors: true } } },
    ],
  ])("refuses %s", (_label, body) => {
    expect(normalize(body).status).toBe("unavailable");
  });
});
