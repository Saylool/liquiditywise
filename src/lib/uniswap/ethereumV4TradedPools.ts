import type { ChainId } from "../chains/chains";
import type { DataResult, V4PoolCandidateList } from "../../schemas";
import type { ReadV4PoolDays } from "./ethereumV4PoolDays";
import { normalizeV4TradedPools } from "./v4TradedPoolsAdapter";

/*
 * The v4 pools a holdings lookup draws its candidate currencies from: the
 * week's busiest pool-days, folded into the pools they belong to.
 *
 * The read itself is in `ethereumV4PoolDays.ts` and is shared with the v4
 * search, which is built from the same list for the reasons given there.
 */

/** Turns one read of the day table into the candidate list. */
export const fetchEthereumV4TradedPools = async (
  readDays: ReadV4PoolDays,
  /** The chain the day table is on; mainnet when not said. */
  chainId: ChainId = 1,
): Promise<DataResult<V4PoolCandidateList>> => {
  const days = await readDays();
  if (days.status === "unavailable") {
    return { status: "unavailable", reason: days.reason, notice: days.notice };
  }

  /*
   * The chain is not asked here. Two hundred and fifty pools is more than the
   * endpoint's budget will answer for in one go, and this list is a net rather
   * than a page: a holdings lookup reads the chain for the few pools it will
   * actually show, once it knows which those are. Every pool here is published
   * with its fee unread, and the manager to ask travels with the list.
   */
  return normalizeV4TradedPools({
    payload: days.data.payload,
    fetchedAt: days.data.fetchedAt,
    chainId,
  });
};
