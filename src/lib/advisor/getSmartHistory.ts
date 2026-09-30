import "server-only";

import { type PersistentHolder, persistentHolders, trendOf, type Trend } from "../analytics/smartHistory";
import { type ChainId, chainOf } from "../chains/chains";
import { openConfiguredStore } from "../store/openStore";
import { readOwnerSets, readSeries } from "./smartStore";

/**
 * What the measurements kept over the last days say: the trend, and the
 * holders that keep turning up. `null` when this deployment keeps none, or
 * the store did not answer — the page then says nothing of it rather than
 * something that reads as "no movement".
 */
export type SmartHistory = {
  /** `null` until a day of measurements is kept. */
  readonly trend: Trend | null;
  /** `null` until enough measurements are kept to say anyone keeps turning up. */
  readonly holders: readonly PersistentHolder[] | null;
};

export const getSmartHistory = async (chainId: ChainId): Promise<SmartHistory | null> => {
  const store = openConfiguredStore();
  if (store === null) return null;

  try {
    const chain = chainOf(chainId).slug;
    const [series, sets] = await Promise.all([readSeries(store, chain), readOwnerSets(store, chain)]);
    if (series === null || sets === null) return null;

    return { trend: trendOf(series), holders: persistentHolders(sets) };
  } catch {
    return null;
  }
};
