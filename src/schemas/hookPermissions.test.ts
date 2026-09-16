import { describe, expect, it } from "vitest";

import {
  alterSwapEconomics,
  alterWithdrawals,
  chargeWithdrawals,
  groupedHookPermissions,
  HOOK_PERMISSION_FLAGS,
  HOOK_PERMISSIONS,
  HOOK_TOPICS,
  hookPermissionsOf,
} from "./index";

/**
 * A hook address carrying exactly the given bits.
 *
 * v4 mines hook addresses so their last fourteen bits spell out the
 * permissions, which is why the rest of the address can be anything.
 */
const hookWith = (...bits: readonly number[]) => {
  const mask = bits.reduce((all, bit) => all | bit, 0);
  return `0x${"a".repeat(36)}${mask.toString(16).padStart(4, "0")}`;
};

describe("hookPermissionsOf", () => {
  /*
   * The address is the permission list. v4 stores a hook's permissions nowhere —
   * the PoolManager reads the low fourteen bits of the address it is calling, so
   * reading them is reading the rule rather than trusting a contract's word.
   */
  it("reads a single permission out of the address", () => {
    expect(hookPermissionsOf(hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP))).toEqual([
      "beforeSwap",
    ]);
  });

  it("reads several, in the order a reader should meet them", () => {
    const address = hookWith(
      HOOK_PERMISSION_FLAGS.AFTER_DONATE,
      HOOK_PERMISSION_FLAGS.BEFORE_SWAP,
      HOOK_PERMISSION_FLAGS.BEFORE_INITIALIZE,
      HOOK_PERMISSION_FLAGS.AFTER_ADD_LIQUIDITY,
    );

    // Swaps first, then deposits, then the rest — not the numeric bit order.
    expect(hookPermissionsOf(address)).toEqual([
      "beforeSwap",
      "afterAddLiquidity",
      "beforeInitialize",
      "afterDonate",
    ]);
  });

  it("reads every permission when every bit is set", () => {
    const all = Object.values(HOOK_PERMISSION_FLAGS).reduce((mask, bit) => mask | bit, 0);

    expect(hookPermissionsOf(hookWith(all))).toHaveLength(HOOK_PERMISSIONS.length);
  });

  it("claims none for an address with no bits set", () => {
    expect(hookPermissionsOf(hookWith(0))).toEqual([]);
  });

  /*
   * The same answer the protocol reaches for `address(0)`: a pool with no hook
   * behaves the way a v3 pool does.
   */
  it("claims none for a pool that runs without a hook", () => {
    expect(hookPermissionsOf(null)).toEqual([]);
  });

  /*
   * Only the low fourteen bits are permissions. The rest of an address is the
   * rest of an address, and reading it as a flag would invent permissions for
   * every hook whose vanity prefix happened to have a bit in the wrong place.
   */
  it("ignores everything above the fourteen bits the protocol defines", () => {
    const noisy = `0x${"f".repeat(36)}0080`;

    expect(hookPermissionsOf(noisy)).toEqual(["beforeSwap"]);
  });
});

describe("alterSwapEconomics", () => {
  /*
   * Singled out because it is the class of permission that changes what every
   * other figure means. A band from price history, a fee tier, a comparison
   * against holding — all assume the pool charges what it says and pays what the
   * curve says, and none of these permissions is visible in a price series.
   */
  it.each([
    ["rewriting the fee before a swap", HOOK_PERMISSION_FLAGS.BEFORE_SWAP],
    ["taking a share before a swap", HOOK_PERMISSION_FLAGS.BEFORE_SWAP_RETURNS_DELTA],
    ["taking a share after one", HOOK_PERMISSION_FLAGS.AFTER_SWAP_RETURNS_DELTA],
  ])("is true for a hook permitted %s", (_label, bit) => {
    const parent =
      bit === HOOK_PERMISSION_FLAGS.BEFORE_SWAP_RETURNS_DELTA
        ? HOOK_PERMISSION_FLAGS.BEFORE_SWAP
        : HOOK_PERMISSION_FLAGS.AFTER_SWAP;

    expect(alterSwapEconomics(hookWith(bit, parent))).toBe(true);
  });

  /*
   * `afterSwap` alone cannot change what the swap cost — it runs once the swap
   * has happened and, without a returns-delta flag, cannot take anything.
   */
  it("is false for a hook that only watches a swap", () => {
    expect(alterSwapEconomics(hookWith(HOOK_PERMISSION_FLAGS.AFTER_SWAP))).toBe(false);
  });

  it.each([
    ["only liquidity callbacks", HOOK_PERMISSION_FLAGS.BEFORE_ADD_LIQUIDITY],
    ["only initialisation", HOOK_PERMISSION_FLAGS.AFTER_INITIALIZE],
    ["only donations", HOOK_PERMISSION_FLAGS.BEFORE_DONATE],
  ])("is false for a hook holding %s", (_label, bit) => {
    expect(alterSwapEconomics(hookWith(bit))).toBe(false);
  });

  it("is false for a pool with no hook at all", () => {
    expect(alterSwapEconomics(null)).toBe(false);
  });
});

describe("groupedHookPermissions", () => {
  /*
   * The page lists what a hook may do under the moment a reader can picture:
   * the swaps that set the price they see, their own deposits and withdrawals,
   * the pool's creation, donations — in that order, whatever the bit order.
   */
  it("groups the permissions by the moment they run at, in reading order", () => {
    const address = hookWith(
      HOOK_PERMISSION_FLAGS.AFTER_DONATE,
      HOOK_PERMISSION_FLAGS.AFTER_SWAP,
      HOOK_PERMISSION_FLAGS.BEFORE_INITIALIZE,
      HOOK_PERMISSION_FLAGS.AFTER_ADD_LIQUIDITY,
      HOOK_PERMISSION_FLAGS.BEFORE_SWAP,
    );

    expect(groupedHookPermissions(address)).toEqual([
      { topic: "swaps", permissions: ["beforeSwap", "afterSwap"] },
      { topic: "liquidity", permissions: ["afterAddLiquidity"] },
      { topic: "creation", permissions: ["beforeInitialize"] },
      { topic: "donations", permissions: ["afterDonate"] },
    ]);
  });

  /* "Around donations: nothing" would be a sentence about an absence. */
  it("leaves out a topic the hook claims nothing under", () => {
    expect(groupedHookPermissions(hookWith(HOOK_PERMISSION_FLAGS.BEFORE_REMOVE_LIQUIDITY))).toEqual([
      { topic: "liquidity", permissions: ["beforeRemoveLiquidity"] },
    ]);
  });

  it("places every permission under exactly one topic, and the topics in their order", () => {
    const all = Object.values(HOOK_PERMISSION_FLAGS).reduce((mask, bit) => mask | bit, 0);
    const groups = groupedHookPermissions(hookWith(all));

    expect(groups.map((group) => group.topic)).toEqual([...HOOK_TOPICS]);
    expect(groups.flatMap((group) => group.permissions)).toEqual([...HOOK_PERMISSIONS]);
  });

  it("groups nothing for a hook with no bits, or for no hook", () => {
    expect(groupedHookPermissions(hookWith(0))).toEqual([]);
    expect(groupedHookPermissions(null)).toEqual([]);
  });
});

describe("alterWithdrawals", () => {
  /*
   * Every callback the protocol runs as part of a withdrawal can refuse it: a
   * hook that reverts reverts the withdrawal with it. That is the other side
   * of the swap warning, for the person holding the position.
   */
  it.each([
    ["before a withdrawal", HOOK_PERMISSION_FLAGS.BEFORE_REMOVE_LIQUIDITY],
    ["after one", HOOK_PERMISSION_FLAGS.AFTER_REMOVE_LIQUIDITY],
  ])("is true for a hook that runs %s", (_label, bit) => {
    expect(alterWithdrawals(hookWith(bit))).toBe(true);
  });

  it.each([
    ["only swap callbacks", HOOK_PERMISSION_FLAGS.BEFORE_SWAP],
    ["only deposits", HOOK_PERMISSION_FLAGS.AFTER_ADD_LIQUIDITY],
    ["only donations", HOOK_PERMISSION_FLAGS.BEFORE_DONATE],
  ])("is false for a hook holding %s", (_label, bit) => {
    expect(alterWithdrawals(hookWith(bit))).toBe(false);
  });

  it("is false for a pool with no hook at all", () => {
    expect(alterWithdrawals(null)).toBe(false);
  });
});

describe("chargeWithdrawals", () => {
  /* Refusing is one thing; taking a share needs the returns-delta flag. */
  it("is true only for a hook permitted to take a share of a withdrawal", () => {
    expect(
      chargeWithdrawals(
        hookWith(
          HOOK_PERMISSION_FLAGS.AFTER_REMOVE_LIQUIDITY,
          HOOK_PERMISSION_FLAGS.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA,
        ),
      ),
    ).toBe(true);
    expect(chargeWithdrawals(hookWith(HOOK_PERMISSION_FLAGS.AFTER_REMOVE_LIQUIDITY))).toBe(false);
    expect(chargeWithdrawals(hookWith(HOOK_PERMISSION_FLAGS.BEFORE_REMOVE_LIQUIDITY))).toBe(false);
  });

  it("does not mistake a share of a deposit for one of a withdrawal", () => {
    expect(
      chargeWithdrawals(
        hookWith(
          HOOK_PERMISSION_FLAGS.AFTER_ADD_LIQUIDITY,
          HOOK_PERMISSION_FLAGS.AFTER_ADD_LIQUIDITY_RETURNS_DELTA,
        ),
      ),
    ).toBe(false);
    expect(chargeWithdrawals(null)).toBe(false);
  });
});
