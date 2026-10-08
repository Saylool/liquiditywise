import "server-only";

import { keptReads } from "../cache/keptReads";
import { getEthereumV3Pool } from "../uniswap/getEthereumV3Pool";
import { getEthereumV4Pool } from "../uniswap/getEthereumV4Pool";
import { poolCardText, type PoolCardText } from "./poolCard";
import { poolCardKey, readPoolCardRequest } from "./poolCardRequest";

/** A day: nothing on a card changes with the price. */
const CARD_TTL_MS = 86_400_000;

/*
 * Five minutes for a card that could not be read.
 *
 * A failure was once not kept at all, on the rule keptReads.ts states — a
 * failure kept is an outage extended. For a card that rule costs too much:
 * the address is public, a crawler may fetch it over and over, and a pool
 * that does not exist (any well-formed id names one, as far as the address
 * can tell) or a source that is down would be asked again on every fetch.
 * Kept briefly, the same failing card asks its source at most once every
 * five minutes, and a source that comes back is asked again soon after.
 */
const CARD_RETRY_MS = 5 * 60_000;

/*
 * As many cards as the cache holds, and no more, the oldest let go first. Only
 * a well-formed pool on a chain read for it is ever a key (poolCardRequest.ts),
 * so a run of junk addresses cannot push the kept cards out.
 */
const MAX_CARDS = 500;

const kept = keptReads<PoolCardText | null>({
  name: "og-pool-card",
  ttlMs: CARD_TTL_MS,
  keep: (text) => text !== null,
  retryMs: CARD_RETRY_MS,
  maxEntries: MAX_CARDS,
});

/** For tests. */
export const forgetPoolCards = (): void => kept.forget();

/**
 * The text of a pool's card, from the address the card was asked for, or
 * `null` for anything that is not a pool this site reads — which the route
 * draws as the site's own card rather than as an error. Read once a day per
 * pool, and a pool that could not be read once every five minutes; an
 * address that names no pool here asks nothing and is kept nowhere.
 */
export const readPoolCard = async (params: URLSearchParams): Promise<PoolCardText | null> => {
  const asked = readPoolCardRequest(params);
  if (asked === null) return null;

  return kept.read(poolCardKey(asked), async () => {
    const pool =
      asked.protocol === "v3"
        ? await getEthereumV3Pool(asked.poolId, asked.chain.id)
        : await getEthereumV4Pool(asked.poolId, asked.chain.id);
    return pool.status === "unavailable" ? null : poolCardText(pool.data);
  });
};
