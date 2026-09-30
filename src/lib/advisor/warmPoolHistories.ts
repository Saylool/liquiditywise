import "server-only";

import { CHAINS } from "../chains/chains";
import { getEthereumDailyPriceHistory } from "../uniswap/getEthereumDailyPriceHistory";
import { getMostTraded } from "./getMostTraded";
import type { MostTradedList } from "./mostTraded";

/*
 * Reads the daily price history of every listed pool ahead of its first
 * reader.
 *
 * The history is the slowest read a pool page makes — five seconds on a first
 * ask, sixteen on a bad one — and it is kept only in memory and only for the
 * UTC day, so the first reader of each pool after a restart or after midnight
 * paid for it: 23 seconds for USDC/WETH on the first open after a deploy. The
 * pools worth doing this for are the ones the most-traded page lists, which
 * are also the ones readers open; a pool outside them is still read on demand.
 *
 * A pool already kept costs nothing, so the rounds can be frequent: what they
 * catch is the restart and the turn of the day. They read from inside the
 * process, so the weekly report's visit count stays people.
 */

/** Every twenty minutes: a turn of the day is caught inside one. */
export const HISTORY_WARM_EVERY_MS = 20 * 60 * 1000;

/** After the most-traded warmer's first round, whose lists this reads its pools from. */
export const HISTORY_FIRST_WARM_AFTER_MS = 90 * 1000;

/** Pools read at once: a few, so a round does not queue at the gateway against a reader. */
const CONCURRENCY = 3;

const idsOf = (list: MostTradedList | null): readonly string[] =>
  list === null || list.status !== "listed" ? [] : list.pools.map(({ pool }) => pool.id);

/** One chain's round: every pool its list names, v3 then v4. */
export const warmPoolHistories = async (chain: (typeof CHAINS)[number]): Promise<{ asked: number; read: number }> => {
  const data = await getMostTraded(chain.id);
  const wanted = [
    ...idsOf(data.v3).map((id) => ["v3", id] as const),
    ...idsOf(data.v4).map((id) => ["v4", id] as const),
  ];

  let read = 0;
  for (let start = 0; start < wanted.length; start += CONCURRENCY) {
    const results = await Promise.all(
      wanted
        .slice(start, start + CONCURRENCY)
        .map(([protocol, id]) => getEthereumDailyPriceHistory(protocol, id, chain.id)),
    );
    read += results.filter((result) => result.status === "success").length;
  }

  console.info(`[history-warm] chain=${chain.slug} pools=${read}/${wanted.length}`);
  return { asked: wanted.length, read };
};
