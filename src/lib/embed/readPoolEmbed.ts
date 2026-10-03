import "server-only";

import { keptReads } from "../cache/keptReads";
import { getPoolRangeAnalysis } from "../advisor/getPoolRangeAnalysis";
import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "../advisor/poolRangeAnalysis";
import type { EmbedRequest } from "./embedRequest";
import { EMBED_TTL_SECONDS } from "./embedResponses";
import { poolEmbedFigures, type PoolEmbedFigures } from "./poolEmbed";

/*
 * One pool's card figures, read through the same pipeline the pool page runs
 * and kept a few minutes per pool.
 *
 * Kept, because a card is loaded by every reader of every page it is pasted
 * into, and all of them are shown the same thing: the default horizon and
 * width, whatever the reader's own preferences. For as long as a cache in
 * front keeps the card (embedResponses.ts), because it carries the current
 * price — a share card, which carries none, is kept a day. What sits
 * under it is kept by its own readers too: the daily history the range is
 * measured from is the slow half, and it is shared with the pool page.
 *
 * Only an answer is kept. A pool that could not be read is asked again on the
 * next load, because a failure kept is an outage extended.
 */

export type PoolEmbedRead =
  | { readonly status: "read"; readonly figures: PoolEmbedFigures }
  | { readonly status: "unreadable" };

const kept = keptReads<PoolEmbedRead>({
  name: "embed-pool",
  ttlMs: EMBED_TTL_SECONDS * 1000,
  keep: (read) => read.status === "read",
});

/** For tests. */
export const forgetPoolEmbeds = (): void => kept.forget();

export const readPoolEmbed = (request: EmbedRequest): Promise<PoolEmbedRead> =>
  kept.read(JSON.stringify([request.protocol, request.chain.id, request.poolId]), async () => {
    /*
     * The pipeline reports its failures as results, and a throw here would be
     * a fault rather than an answer — but a card on somebody else's page is
     * no place to show one, so it is the same card either way.
     */
    try {
      const result = await getPoolRangeAnalysis(
        request.protocol,
        request.poolId,
        DEFAULT_PRICE_BAND_PARAMETERS,
        DEFAULT_DEPOSIT_USD,
        undefined,
        request.chain.id,
      );
      return result.status === "unavailable"
        ? { status: "unreadable" }
        : { status: "read", figures: poolEmbedFigures(result.data, request) };
    } catch {
      return { status: "unreadable" };
    }
  });
