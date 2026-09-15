import {
  type AddressHoldings,
  AddressHoldingsSchema,
  type DataFailureNotice,
  type DataFailureReason,
  type DataResult,
  type HeldSides,
  type HoldingPool,
  type PoolCandidateList,
  type TokenHolding,
  type V3Token,
} from "../../schemas";
import type { Erc20Balances } from "../uniswap/ethereumErc20Balances";

/*
 * Two reads in, one answer out: which of the candidate tokens an address holds,
 * and which of the candidate pools it can therefore put something into.
 *
 * Pure — no clock, no network, no environment — so the whole thing is testable
 * without credentials, like every other composition here.
 *
 * The two reads cannot run side by side, unlike the three behind a range
 * analysis. The tokens to ask about come out of the pool list, so the pool list
 * has to arrive first. That is a property of the question, not a missed
 * optimisation: nothing can enumerate an address's tokens, so the candidates
 * have to be chosen before they can be checked.
 */

const HOLDINGS_UNVERIFIABLE = "holdings-unverifiable";

export type AddressHoldingsInput = {
  readonly address: string;
  readonly candidates: DataResult<PoolCandidateList>;
  readonly balances: DataResult<Erc20Balances>;
  readonly fetchedAt: string;
};

/**
 * Forwards a failed read unchanged.
 *
 * The reason stays whatever the read that failed said it was — a timeout, a rate
 * limit, a missing key — rather than being flattened into one category here. The
 * page tells the reader which stage could not answer, and that is only possible
 * if the stage's own answer survives the trip.
 */
const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<AddressHoldings> => ({ status: "unavailable", reason, notice });

/** Which sides of a pool are held, or `null` when neither is. */
const sidesHeld = (
  pool: HoldingPool["pool"],
  held: ReadonlySet<string>,
): HeldSides | null => {
  const hasToken0 = held.has(pool.token0.address);
  const hasToken1 = held.has(pool.token1.address);

  if (hasToken0 && hasToken1) return "both";
  if (hasToken0) return "token0";
  if (hasToken1) return "token1";

  return null;
};

/**
 * Builds the answer from a pool list and a set of balances.
 *
 * Both reads must have succeeded. Unlike a range analysis, where a snapshot
 * missing one field still carries the price the band needs, there is no partial
 * version of this: an address whose balances could not be read is not an address
 * that holds nothing, and saying so would be the worst available answer.
 */
export const composeAddressHoldings = (
  input: AddressHoldingsInput,
): DataResult<AddressHoldings> => {
  const { candidates, balances } = input;
  if (candidates.status === "unavailable") {
    return unavailable(candidates.reason, candidates.notice);
  }
  if (balances.status === "unavailable") {
    return unavailable(balances.reason, balances.notice);
  }

  /*
   * Token identities come from the pool list rather than from the chain. Every
   * one there has already been through the same verification a searched pool's
   * tokens go through — the symbol rules, the decimals, the non-zero address —
   * and a balance read answers with a number and no identity at all.
   */
  const tokensByAddress = new Map<string, V3Token>();
  for (const pool of candidates.data.pools) {
    tokensByAddress.set(pool.token0.address, pool.token0);
    tokensByAddress.set(pool.token1.address, pool.token1);
  }

  const holdings: TokenHolding[] = [];
  const heldAddresses = new Set<string>();
  for (const balance of balances.data.held) {
    const token = tokensByAddress.get(balance.address);
    // A balance for a token that is not in the list is a balance for a token
    // nobody asked about, and there is no verified identity to show it under.
    if (token === undefined || heldAddresses.has(balance.address)) continue;
    heldAddresses.add(balance.address);
    holdings.push({ token, amount: balance.amount });
  }

  /*
   * Pools with both sides held first, and the source's own order within each
   * group. The grouping is a statement about the reader — a pool you already
   * hold both sides of is one you can enter without swapping first — and not
   * about which pool is better.
   */
  const entries: HoldingPool[] = [];
  for (const pool of candidates.data.pools) {
    const heldSides = sidesHeld(pool, heldAddresses);
    if (heldSides !== null) entries.push({ pool, heldSides });
  }
  const pools = [
    ...entries.filter((entry) => entry.heldSides === "both"),
    ...entries.filter((entry) => entry.heldSides !== "both"),
  ];

  const verified = AddressHoldingsSchema.safeParse({
    address: input.address,
    tokensChecked: balances.data.checked,
    holdings,
    pools,
    fetchedAt: input.fetchedAt,
    sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
  });
  if (!verified.success) return unavailable("invalid-response", HOLDINGS_UNVERIFIABLE);

  return { status: "success", data: verified.data };
};
