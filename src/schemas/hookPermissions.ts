import { ALL_HOOK_MASK, HOOK_PERMISSION_FLAGS, hookPermissionBits } from "./uniswap";

/*
 * What a v4 hook is permitted to do, read out of its own address.
 *
 * This is the fact that makes a v4 pool different from a v3 one, and the only
 * one about a hook that can be stated without trusting anybody. v4 does not
 * store a hook's permissions anywhere: a hook is deployed to an address whose
 * low fourteen bits spell out which callbacks the PoolManager will invoke on it,
 * and the PoolManager checks those bits rather than asking the contract. The
 * address is the permission list.
 *
 * So this says what a hook *may* do and never what it does. Reading the
 * contract's code, or its name, or its documentation, would be taking somebody's
 * word for it; reading the address is reading the rule the protocol enforces. A
 * hook permitted to rewrite the fee on every swap may always return the same
 * fee — that is not knowable from here, and the interface says so rather than
 * guessing either way.
 */

/**
 * The permissions, in the order a reader should meet them: what happens around
 * a swap first, because that is what a liquidity provider feels, then what
 * happens around their own deposits, then the rest.
 *
 * `satisfies` rather than a plain array, so adding a flag above without listing
 * it here is a compile error rather than a permission that silently stops being
 * mentioned.
 */
export const HOOK_PERMISSIONS = [
  "beforeSwap",
  "afterSwap",
  "beforeSwapReturnsDelta",
  "afterSwapReturnsDelta",
  "beforeAddLiquidity",
  "afterAddLiquidity",
  "afterAddLiquidityReturnsDelta",
  "beforeRemoveLiquidity",
  "afterRemoveLiquidity",
  "afterRemoveLiquidityReturnsDelta",
  "beforeInitialize",
  "afterInitialize",
  "beforeDonate",
  "afterDonate",
] as const;

export type HookPermission = (typeof HOOK_PERMISSIONS)[number];

/**
 * Each permission's bit, keyed by the name the interface uses.
 *
 * `satisfies Record<HookPermission, number>` is what ties the two together: a
 * name in the list with no bit here, or a bit here with no name in the list,
 * fails the build.
 */
const PERMISSION_BITS = {
  beforeSwap: HOOK_PERMISSION_FLAGS.BEFORE_SWAP,
  afterSwap: HOOK_PERMISSION_FLAGS.AFTER_SWAP,
  beforeSwapReturnsDelta: HOOK_PERMISSION_FLAGS.BEFORE_SWAP_RETURNS_DELTA,
  afterSwapReturnsDelta: HOOK_PERMISSION_FLAGS.AFTER_SWAP_RETURNS_DELTA,
  beforeAddLiquidity: HOOK_PERMISSION_FLAGS.BEFORE_ADD_LIQUIDITY,
  afterAddLiquidity: HOOK_PERMISSION_FLAGS.AFTER_ADD_LIQUIDITY,
  afterAddLiquidityReturnsDelta: HOOK_PERMISSION_FLAGS.AFTER_ADD_LIQUIDITY_RETURNS_DELTA,
  beforeRemoveLiquidity: HOOK_PERMISSION_FLAGS.BEFORE_REMOVE_LIQUIDITY,
  afterRemoveLiquidity: HOOK_PERMISSION_FLAGS.AFTER_REMOVE_LIQUIDITY,
  afterRemoveLiquidityReturnsDelta: HOOK_PERMISSION_FLAGS.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA,
  beforeInitialize: HOOK_PERMISSION_FLAGS.BEFORE_INITIALIZE,
  afterInitialize: HOOK_PERMISSION_FLAGS.AFTER_INITIALIZE,
  beforeDonate: HOOK_PERMISSION_FLAGS.BEFORE_DONATE,
  afterDonate: HOOK_PERMISSION_FLAGS.AFTER_DONATE,
} as const satisfies Record<HookPermission, number>;

/**
 * Every permission a hook address claims, in reading order.
 *
 * A null hook claims none, which is the same answer the protocol reaches for
 * `address(0)` — and it is worth saying plainly rather than leaving as an empty
 * list with no explanation: a pool with no hook behaves the way a v3 pool does.
 */
export const hookPermissionsOf = (
  hookAddress: string | null,
): readonly HookPermission[] => {
  if (hookAddress === null) return [];

  const bits = hookPermissionBits(hookAddress);

  return HOOK_PERMISSIONS.filter((permission) => (bits & PERMISSION_BITS[permission]) !== 0);
};

/**
 * Whether a hook may alter what a swap costs or pays.
 *
 * Singled out because it is the one class of permission that changes what every
 * other figure on an analysis page means. A band drawn from price history, a
 * fee tier, a comparison against holding — all of them assume the pool charges
 * what it says and pays out what the curve says. A hook holding `beforeSwap` can
 * rewrite the fee; one holding a returns-delta flag can take a share of the
 * swap itself. Neither is visible in a price series.
 */
export const alterSwapEconomics = (hookAddress: string | null): boolean =>
  hookPermissionsOf(hookAddress).some(
    (permission) =>
      permission === "beforeSwap" ||
      permission === "beforeSwapReturnsDelta" ||
      permission === "afterSwapReturnsDelta",
  );

/**
 * Whether a hook may stand between a provider and their withdrawal.
 *
 * Singled out for the same reason as the swap economics, from the other side:
 * it changes what holding a position means. Every callback the protocol runs as
 * part of a withdrawal can refuse it — a hook that reverts reverts the
 * withdrawal with it. The returns-delta flag, which requires the after
 * callback, additionally lets the hook take a share of what comes out; see
 * {@link chargeWithdrawals}. None of it shows in a price series, or in a fee.
 */
export const alterWithdrawals = (hookAddress: string | null): boolean =>
  hookPermissionsOf(hookAddress).some(
    (permission) =>
      permission === "beforeRemoveLiquidity" || permission === "afterRemoveLiquidity",
  );

/** Whether a hook may take a share of what a provider withdraws, and not only refuse it. */
export const chargeWithdrawals = (hookAddress: string | null): boolean =>
  hookPermissionsOf(hookAddress).includes("afterRemoveLiquidityReturnsDelta");

/**
 * The moments a reader can picture, for the permissions to be listed under.
 *
 * The protocol's names say where in its own code a hook is called. A reader
 * who has never provided liquidity meets those moments as the swaps that set
 * the price they see, their own deposits and withdrawals, the pool's creation,
 * and the donations that occasionally go to a pool's providers — so that is
 * how the page groups them, in that order.
 */
export const HOOK_TOPICS = ["swaps", "liquidity", "creation", "donations"] as const;

export type HookTopic = (typeof HOOK_TOPICS)[number];

/**
 * `satisfies Record<HookPermission, HookTopic>`: a permission under no topic
 * fails the build, so none can be added above and go unlisted on the page.
 */
const TOPIC_OF = {
  beforeSwap: "swaps",
  afterSwap: "swaps",
  beforeSwapReturnsDelta: "swaps",
  afterSwapReturnsDelta: "swaps",
  beforeAddLiquidity: "liquidity",
  afterAddLiquidity: "liquidity",
  afterAddLiquidityReturnsDelta: "liquidity",
  beforeRemoveLiquidity: "liquidity",
  afterRemoveLiquidity: "liquidity",
  afterRemoveLiquidityReturnsDelta: "liquidity",
  beforeInitialize: "creation",
  afterInitialize: "creation",
  beforeDonate: "donations",
  afterDonate: "donations",
} as const satisfies Record<HookPermission, HookTopic>;

export type HookPermissionGroup = {
  readonly topic: HookTopic;
  /** In reading order; never empty. */
  readonly permissions: readonly HookPermission[];
};

/**
 * The permissions a hook claims, grouped by topic in the order above.
 *
 * A topic the hook claims nothing under is left out rather than shown empty:
 * "around donations: nothing" would be a sentence about an absence, and the
 * list is of what the hook may do.
 */
export const groupedHookPermissions = (
  hookAddress: string | null,
): readonly HookPermissionGroup[] => {
  const claimed = hookPermissionsOf(hookAddress);

  return HOOK_TOPICS.flatMap((topic) => {
    const permissions = claimed.filter((permission) => TOPIC_OF[permission] === topic);
    return permissions.length === 0 ? [] : [{ topic, permissions }];
  });
};

/** Every bit outside the fourteen the protocol defines. Always zero in practice. */
export const UNDEFINED_HOOK_BITS = ~ALL_HOOK_MASK;
