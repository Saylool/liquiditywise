import { describe, expect, it } from "vitest";

import { HOOK_PERMISSION_FLAGS, type Pool, type V4FeeConfiguration } from "../../schemas";
import { feeDisclosureFor } from "./feeDisclosure";

/**
 * A hook address whose low fourteen bits carry exactly these permissions.
 *
 * v4 hooks are deployed to mined addresses, so this is what a real one looks
 * like: arbitrary leading bytes, and a trailing nibble pair that is the
 * permission list.
 */
const hookWith = (...flags: readonly number[]): string => {
  const bits = flags.reduce((all, flag) => all | flag, 0);

  return `0x${"1".repeat(36)}${bits.toString(16).padStart(4, "0")}`;
};

const token = (address: string) => ({ chainId: 1, address, symbol: "T", decimals: 18 });
const TOKEN0 = token(`0x${"a".repeat(40)}`);
const TOKEN1 = token(`0x${"b".repeat(40)}`);

const v3Pool = (feePpm: number): Pool => ({
  protocolVersion: "v3",
  chainId: 1,
  id: `0x${"c".repeat(40)}`,
  token0: TOKEN0,
  token1: TOKEN1,
  feePpm,
  tickSpacing: 60,
});

const v4Pool = (fee: V4FeeConfiguration, hookAddress: string | null): Pool => ({
  protocolVersion: "v4",
  chainId: 1,
  id: `0x${"d".repeat(64)}`,
  token0: TOKEN0,
  token1: TOKEN1,
  tickSpacing: 10,
  fee,
  hookAddress,
});

describe("feeDisclosureFor", () => {
  it("reads a v3 pool's tier, which nothing can rewrite", () => {
    expect(feeDisclosureFor(v3Pool(3000))).toEqual({
      declaredPpm: 3000,
      hookMayAlterSwaps: false,
      mayAttributeFeesToRange: true,
    });
  });

  it("reads a hookless v4 pool's fee the same way", () => {
    const pool = v4Pool({ kind: "static", feePpm: 125 }, null);

    expect(feeDisclosureFor(pool)).toEqual({
      declaredPpm: 125,
      hookMayAlterSwaps: false,
      mayAttributeFeesToRange: true,
    });
  });

  /*
   * A dynamic-fee pool declares nothing: its PoolKey carries a sentinel where
   * the number would be. That is not a fee of zero and not a missing field.
   */
  it("reports no declared rate for a dynamic-fee pool", () => {
    const pool = v4Pool(
      { kind: "dynamic", currentFeePpm: null },
      hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP),
    );

    expect(feeDisclosureFor(pool).declaredPpm).toBeNull();
  });

  /*
   * The observed fee of a dynamic pool is one moment's reading, not a
   * declaration. Returning it here would let a month of charged fees be compared
   * against a single instant and the difference read as a disagreement.
   */
  it("still reports no declared rate when a current fee was observed", () => {
    const pool = v4Pool(
      { kind: "dynamic", currentFeePpm: 500 },
      hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP),
    );

    expect(feeDisclosureFor(pool).declaredPpm).toBeNull();
  });

  describe("what may be attributed to the range", () => {
    /*
     * A hook that only runs on deposits and withdrawals cannot touch a swap, so
     * the fees a swap paid are attributable exactly as they are in v3. Withholding
     * them here would be a caveat the pool has not earned.
     */
    it("permits attribution for a hook that cannot touch a swap", () => {
      const pool = v4Pool(
        { kind: "static", feePpm: 500 },
        hookWith(
          HOOK_PERMISSION_FLAGS.BEFORE_ADD_LIQUIDITY,
          HOOK_PERMISSION_FLAGS.AFTER_REMOVE_LIQUIDITY,
        ),
      );

      expect(feeDisclosureFor(pool).hookMayAlterSwaps).toBe(false);
      expect(feeDisclosureFor(pool).mayAttributeFeesToRange).toBe(true);
    });

    it("refuses attribution for a hook that runs before a swap", () => {
      const pool = v4Pool(
        { kind: "static", feePpm: 500 },
        hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP),
      );

      expect(feeDisclosureFor(pool).mayAttributeFeesToRange).toBe(false);
    });

    it("refuses attribution for a hook that takes a share of the swap", () => {
      const pool = v4Pool(
        { kind: "static", feePpm: 500 },
        hookWith(
          HOOK_PERMISSION_FLAGS.AFTER_SWAP,
          HOOK_PERMISSION_FLAGS.AFTER_SWAP_RETURNS_DELTA,
        ),
      );

      expect(feeDisclosureFor(pool).mayAttributeFeesToRange).toBe(false);
    });

    /* The declared rate is still real and still reported; only attribution stops. */
    it("keeps reporting the declared rate even when attribution is refused", () => {
      const pool = v4Pool(
        { kind: "static", feePpm: 250 },
        hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP),
      );

      expect(feeDisclosureFor(pool).declaredPpm).toBe(250);
    });
  });
});
