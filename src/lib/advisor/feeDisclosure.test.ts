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

/** The protocol's cut, the same in both directions, as on every mainnet pool read. */
const protocol = (ppm: number) => ({ zeroForOnePpm: ppm, oneForZeroPpm: ppm });

const v4Pool = (
  fee: V4FeeConfiguration,
  hookAddress: string | null,
  protocolFee: { zeroForOnePpm: number; oneForZeroPpm: number } | null = protocol(0),
): Pool => ({
  protocolVersion: "v4",
  chainId: 1,
  id: `0x${"d".repeat(64)}`,
  token0: TOKEN0,
  token1: TOKEN1,
  tickSpacing: 10,
  fee,
  protocolFee,
  hookAddress,
});

describe("feeDisclosureFor", () => {
  it("reads a v3 pool's tier, which nothing can rewrite and nothing sits on top of", () => {
    expect(feeDisclosureFor(v3Pool(3000))).toEqual({
      lpFeePpm: 3000,
      protocolFee: null,
      statedSwapFee: { lowestPpm: 3000, highestPpm: 3000 },
      hookMayAlterSwaps: false,
      mayAttributeFeesToRange: true,
    });
  });

  it("reads a hookless v4 pool's fee the same way when the protocol takes nothing", () => {
    const pool = v4Pool({ kind: "static", feePpm: 125 }, null);

    expect(feeDisclosureFor(pool)).toEqual({
      lpFeePpm: 125,
      protocolFee: protocol(0),
      statedSwapFee: { lowestPpm: 125, highestPpm: 125 },
      hookMayAlterSwaps: false,
      mayAttributeFeesToRange: true,
    });
  });

  /*
   * The ETH/USDC pool as the chain held it: 500 ppm to providers, 125 ppm to
   * the protocol on top, 625 ppm paid by a swap — and 625 is what the indexer
   * had been calling the fee tier.
   */
  it("combines the protocol's cut into what a swap pays", () => {
    const pool = v4Pool({ kind: "static", feePpm: 500 }, null, protocol(125));

    expect(feeDisclosureFor(pool).lpFeePpm).toBe(500);
    expect(feeDisclosureFor(pool).protocolFee).toEqual(protocol(125));
    expect(feeDisclosureFor(pool).statedSwapFee).toEqual({ lowestPpm: 625, highestPpm: 625 });
  });

  it("states a range when the cut differs by direction", () => {
    const pool = v4Pool({ kind: "static", feePpm: 500 }, null, { zeroForOnePpm: 100, oneForZeroPpm: 125 });

    expect(feeDisclosureFor(pool).statedSwapFee).toEqual({ lowestPpm: 600, highestPpm: 625 });
  });

  it("states nothing when the pool's state was not read", () => {
    const pool = v4Pool({ kind: "static", feePpm: 500 }, null, null);

    expect(feeDisclosureFor(pool).lpFeePpm).toBe(500);
    expect(feeDisclosureFor(pool).statedSwapFee).toBeNull();
  });

  it("states nothing for a pool whose key was not read", () => {
    const pool = v4Pool({ kind: "unread" }, null);

    expect(feeDisclosureFor(pool).lpFeePpm).toBeNull();
    expect(feeDisclosureFor(pool).statedSwapFee).toBeNull();
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

    expect(feeDisclosureFor(pool).lpFeePpm).toBeNull();
    expect(feeDisclosureFor(pool).statedSwapFee).toBeNull();
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

    expect(feeDisclosureFor(pool).lpFeePpm).toBeNull();
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

      expect(feeDisclosureFor(pool).lpFeePpm).toBe(250);
    });
  });
});
