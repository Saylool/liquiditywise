import {
  type AddressHoldings,
  AddressHoldingsSchema,
  type DataFailureNotice,
  type DataFailureReason,
  type DataResult,
  type HeldSides,
  type HoldingPool,
  type HoldingsSource,
  ONE_SIDED_SHOWN,
  type PoolCandidateList,
  type Token,
  type TokenHolding,
  type V4Pool,
  type V4PoolCandidateList,
} from "../../schemas";
import { applyV4ChainReading } from "../uniswap/v4PoolAdapter";
import type { V4PoolChainReading } from "../uniswap/v4PoolChainReading";
import type { AddressBalances } from "../uniswap/ethereumBalances";

/*
 * Three reads in, one answer out: which of the candidate currencies an address
 * holds, and which of the candidate pools — of either protocol — it can
 * therefore put something into.
 *
 * Pure — no clock, no network, no environment — so the whole thing is testable
 * without credentials, like every other composition here.
 *
 * The balance read cannot run beside the two lists, unlike the three behind a
 * range analysis. The currencies to ask about come out of the lists, so the
 * lists have to arrive first. That is a property of the question, not a missed
 * optimisation: nothing can enumerate an address's tokens, so the candidates
 * have to be chosen before they can be checked.
 */

const HOLDINGS_UNVERIFIABLE = "holdings-unverifiable";

export type AddressHoldingsInput = {
  readonly address: string;
  readonly v3Candidates: DataResult<PoolCandidateList>;
  /**
   * The v4 net. Allowed to be missing where the v3 one is not: a deployment
   * with no v4 subgraph configured still has an answer, and the page says the
   * v4 net was not cast rather than implying no v4 pool takes what is held.
   */
  readonly v4Candidates: DataResult<V4PoolCandidateList>;
  readonly balances: DataResult<AddressBalances>;
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
 * Builds the answer from the pool lists and a set of balances.
 *
 * The balances must have been read: an address whose balances could not be
 * read is not an address that holds nothing, and saying so would be the worst
 * available answer. At least one list must have been read too — with neither
 * there was nothing to ask about — and a list that was not is recorded as a
 * net that was not cast, which the page states.
 */
export const composeAddressHoldings = (
  input: AddressHoldingsInput,
): DataResult<AddressHoldings> => {
  const { v3Candidates, v4Candidates, balances } = input;
  if (v3Candidates.status === "unavailable" && v4Candidates.status === "unavailable") {
    return unavailable(v3Candidates.reason, v3Candidates.notice);
  }
  if (balances.status === "unavailable") {
    return unavailable(balances.reason, balances.notice);
  }

  const v3Pools = v3Candidates.status === "unavailable" ? [] : v3Candidates.data.pools;
  const v4Pools = v4Candidates.status === "unavailable" ? [] : v4Candidates.data.pools;

  /*
   * Currency identities come from the pool lists rather than from the chain.
   * Every one there has already been through the same verification a searched
   * pool's currencies go through, and a balance read answers with a number and
   * no identity at all. The v4 list is what can name the chain's own ether.
   */
  const tokensByAddress = new Map<string, Token>();
  for (const pool of [...v3Pools, ...v4Pools]) {
    if (!tokensByAddress.has(pool.token0.address)) tokensByAddress.set(pool.token0.address, pool.token0);
    if (!tokensByAddress.has(pool.token1.address)) tokensByAddress.set(pool.token1.address, pool.token1);
  }

  const holdings: TokenHolding[] = [];
  const heldAddresses = new Set<string>();
  for (const balance of balances.data.held) {
    const token = tokensByAddress.get(balance.address);
    // A balance for a currency that is in neither list is a balance nobody asked
    // about, and there is no verified identity to show it under.
    if (token === undefined || heldAddresses.has(balance.address)) continue;
    heldAddresses.add(balance.address);
    holdings.push({ token, amount: balance.amount });
  }

  /*
   * Pools with both sides held first, and each source's own order within each
   * group — v3's list, then v4's. The grouping is a statement about the reader:
   * a pool you already hold both sides of is one you can enter without swapping
   * first. It says nothing about which pool is better, and neither does the
   * order of the two protocols inside a group.
   */
  const entries: HoldingPool[] = [];
  for (const pool of [...v3Pools, ...v4Pools]) {
    const heldSides = sidesHeld(pool, heldAddresses);
    if (heldSides !== null) entries.push({ pool, heldSides });
  }
  const pools = [
    ...entries.filter((entry) => entry.heldSides === "both"),
    ...entries.filter((entry) => entry.heldSides !== "both"),
  ];

  const sources: HoldingsSource[] = [
    ...(v3Candidates.status === "unavailable" ? [] : (["uniswap-v3-subgraph"] as const)),
    ...(v4Candidates.status === "unavailable" ? [] : (["uniswap-v4-subgraph"] as const)),
    "ethereum-rpc",
  ];

  const verified = AddressHoldingsSchema.safeParse({
    address: input.address,
    tokensChecked: balances.data.checked,
    holdings,
    pools,
    poolsSearched: {
      v3: v3Candidates.status === "unavailable" ? null : v3Pools.length,
      v4: v4Candidates.status === "unavailable" ? null : v4Pools.length,
    },
    fetchedAt: input.fetchedAt,
    sources,
  });
  if (!verified.success) return unavailable("invalid-response", HOLDINGS_UNVERIFIABLE);

  return { status: "success", data: verified.data };
};

/**
 * The v4 pools a holdings page will show: every pool with both sides held,
 * and the first one-sided ones up to the display cut, in the order they are
 * shown. These are the pools worth asking the chain about; the candidate list
 * they came from carries every fee unread, and two hundred and fifty pools is
 * more than the endpoint's budget answers for.
 */
export const displayedV4Pools = (holdings: AddressHoldings): readonly V4Pool[] => {
  const both = holdings.pools.filter((entry) => entry.heldSides === "both");
  const one = holdings.pools.filter((entry) => entry.heldSides !== "both").slice(0, ONE_SIDED_SHOWN);

  return [...both, ...one]
    .map((entry) => entry.pool)
    .filter((pool): pool is V4Pool => pool.protocolVersion === "v4");
};

/**
 * The same holdings with what the chain said about each shown v4 pool
 * applied: its fee and the protocol's cut. A pool the chain answered nothing
 * for keeps its fee unread; a pool whose reading contradicts the indexer's
 * record is dropped, as it would be from any list.
 *
 * Pure, and re-verified whole: the result goes back through the schema, and
 * if that fails the caller keeps the holdings as they were rather than losing
 * the page over a fee.
 */
export const withV4ChainReadings = (
  holdings: AddressHoldings,
  readings: ReadonlyMap<string, V4PoolChainReading>,
): AddressHoldings | null => {
  const pools: HoldingPool[] = [];
  for (const entry of holdings.pools) {
    if (entry.pool.protocolVersion !== "v4") {
      pools.push(entry);
      continue;
    }
    const reading = readings.get(entry.pool.id);
    if (reading === undefined) {
      pools.push(entry);
      continue;
    }
    const applied = applyV4ChainReading(entry.pool, reading);
    if (applied !== null) pools.push({ ...entry, pool: applied });
  }

  const verified = AddressHoldingsSchema.safeParse({ ...holdings, pools });

  return verified.success ? verified.data : null;
};
