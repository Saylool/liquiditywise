import "server-only";

import { type ChainId, chainOf, readsV3Positions } from "../chains/chains";
import { openConfiguredStore } from "../store/openStore";
import { type WeeklyReading, weeklyReadingOf } from "../telegram/weeklyDigest";
import { readSeries } from "./smartStore";

/*
 * The week's reading for the /weekly page, from the series the smart-money
 * measurement keeps (smartStore.ts): the same series the bot's Monday digest
 * is read off, through the same composition, so the page and the message say
 * the same thing about the same week.
 *
 * Only what is kept, never a measurement: a page open to crawlers must not
 * start a read of a dozen pools. `null` where the chain's positions cannot be
 * listed, where this deployment keeps no series, or where the store did not
 * answer — the page then says the kept measurements could not be read, rather
 * than something that reads as "nothing moved".
 */
export const getWeeklyReading = async (chainId: ChainId): Promise<WeeklyReading | null> => {
  if (!readsV3Positions(chainId)) return null;
  const store = openConfiguredStore();
  if (store === null) return null;

  try {
    const series = await readSeries(store, chainOf(chainId).slug);
    return series === null ? null : weeklyReadingOf(series);
  } catch {
    return null;
  }
};
