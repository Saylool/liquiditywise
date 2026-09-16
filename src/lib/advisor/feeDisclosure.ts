import {
  alterSwapEconomics,
  lpFeePpm,
  type Pool,
  statedSwapFee,
  type StatedSwapFee,
  type V4ProtocolFee,
} from "../../schemas";

/*
 * What this application is willing to say about a pool's fees.
 *
 * One module, so the page and the prompt handed to the model cannot disagree.
 * They did not share a decision before because there was no decision: in v3 the
 * pool charges its tier, the tier is public, and the fees the source reports
 * follow from both. v4 keeps the first two and breaks the third.
 */

export type FeeDisclosure = {
  /** The fee that goes to liquidity providers, or `null` when nothing fixed says. */
  readonly lpFeePpm: number | null;
  /**
   * The protocol's cut on top of it, per direction, or `null` where there is
   * none to speak of: every v3 pool, and a v4 pool whose state was not read.
   */
  readonly protocolFee: V4ProtocolFee | null;
  /**
   * What a swap pays by the pool's own terms — the two combined the way the
   * chain combines them — or `null` when its hook sets the fee per swap.
   */
  readonly statedSwapFee: StatedSwapFee | null;
  /**
   * Whether this pool's hook holds a permission that lets it change what a swap
   * costs or pays.
   *
   * Read from the hook's address, which is where v4 keeps it — not from a
   * registry, a label or the contract's own claims about itself.
   */
  readonly hookMayAlterSwaps: boolean;
  /**
   * Whether a fee figure may be attributed to the range at all.
   *
   * False exactly when the hook may alter swap economics. The fees a pool
   * charged are a fact either way, and the page still reports them — but
   * "the fees charged while price sat inside this range" is a step further:
   * it is the figure a reader turns into an expectation about a position. A
   * hook holding a returns-delta permission can take a share of the swap
   * itself, and nothing in the source separates the hook's share from the
   * liquidity providers'. Publishing the figure anyway would put a number on
   * the page whose relationship to a position nobody can state, next to the
   * range it appears to describe.
   */
  readonly mayAttributeFeesToRange: boolean;
};

/**
 * Decides what may be said about one pool's fees.
 *
 * Pure, and derived entirely from things the protocol fixes: the fee in the
 * pool's own deployment or PoolKey, and the permission bits mined into its
 * hook's address. Nothing here consults a list of known hooks, because a list
 * would be a claim about a contract's behaviour that this application cannot
 * make.
 */
export const feeDisclosureFor = (pool: Pool): FeeDisclosure => {
  const hookMayAlterSwaps =
    pool.protocolVersion === "v4" && alterSwapEconomics(pool.hookAddress);

  return {
    lpFeePpm: lpFeePpm(pool),
    protocolFee: pool.protocolVersion === "v4" ? pool.protocolFee : null,
    statedSwapFee: statedSwapFee(pool),
    hookMayAlterSwaps,
    mayAttributeFeesToRange: !hookMayAlterSwaps,
  };
};
