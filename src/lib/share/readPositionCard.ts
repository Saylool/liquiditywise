import "server-only";

import { getPositionRecord, type PositionRecordRead } from "../advisor/getPositionRecord";
import { keptReads } from "../cache/keptReads";
import type { ShareRequest } from "./shareRequest";
import { SHARE_TTL_SECONDS } from "./shareResponses";

/*
 * One position and its record, read for its card and kept a few minutes.
 *
 * Kept, because a shared card is loaded by everyone the link reaches, and all
 * of them are shown the same position at the same reading: a card in Turkish
 * and one in English are one read, since the figures are the same and only
 * the words differ. For as long as a cache in front keeps the card
 * (shareResponses.ts), because the record is valued at today's price.
 *
 * A position the chain holds none of is kept too — it is the cheapest answer
 * there is and the one a dead link asks for most — but a position that could
 * not be read is not: a failure kept is an outage extended.
 */

const kept = keptReads<PositionRecordRead>({
  name: "share-position",
  ttlMs: SHARE_TTL_SECONDS * 1000,
  keep: (read) => read.status !== "unavailable",
});

/** For tests. */
export const forgetPositionCards = (): void => kept.forget();

export const readPositionCard = (request: ShareRequest): Promise<PositionRecordRead> =>
  kept.read(JSON.stringify([request.chainId, request.tokenId]), () => getPositionRecord(request.tokenId, request.chainId));
