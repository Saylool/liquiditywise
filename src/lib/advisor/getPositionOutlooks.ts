import "server-only";

import type { Position, PriceBandParameters } from "../../schemas";
import { chainOf } from "../chains/chains";
import { getEthereumDailyPriceHistory } from "../uniswap/getEthereumDailyPriceHistory";
import { positionOutlook, type PositionOutlook } from "./positionOutlook";

/** At most this many pools are read for one address, however many it holds positions in. */
export const OUTLOOK_POOL_LIMIT = 12;

/** How a position is found in the map: its protocol and token, as the list keys it. */
export const outlookKey = (position: Position): string => `${position.pool.protocolVersion}-${position.tokenId}`;

/**
 * The outlook of each open position, from one daily history per pool.
 *
 * The histories are the pool pages' own, cached for the day, so an address
 * whose pools someone has already opened costs nothing more. A pool whose
 * history cannot be read leaves its positions without an outlook, and the
 * rows say nothing rather than something made up.
 */
export const getPositionOutlooks = async (
  positions: readonly Position[],
  parameters: PriceBandParameters,
): Promise<ReadonlyMap<string, PositionOutlook>> => {
  const pools = new Map<string, Position["pool"]>();
  for (const { pool } of positions) {
    const key = `${pool.chainId}|${pool.protocolVersion}|${pool.id.toLowerCase()}`;
    if (!pools.has(key) && pools.size < OUTLOOK_POOL_LIMIT) pools.set(key, pool);
  }

  const histories = new Map(
    await Promise.all(
      [...pools].map(
        async ([key, pool]) =>
          [key, await getEthereumDailyPriceHistory(pool.protocolVersion, pool.id, chainOf(pool.chainId).id)] as const,
      ),
    ),
  );

  const outlooks = new Map<string, PositionOutlook>();
  for (const position of positions) {
    const { pool } = position;
    const history = histories.get(`${pool.chainId}|${pool.protocolVersion}|${pool.id.toLowerCase()}`);
    if (history === undefined || history.status === "unavailable") continue;
    const outlook = positionOutlook({ position, history: history.data, parameters });
    if (outlook !== null) outlooks.set(outlookKey(position), outlook);
  }

  return outlooks;
};
