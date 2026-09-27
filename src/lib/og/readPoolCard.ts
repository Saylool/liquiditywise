import "server-only";

import { chainBySlug, readsV3, readsV4 } from "../chains/chains";
import { keptReads } from "../cache/keptReads";
import { getEthereumV3Pool } from "../uniswap/getEthereumV3Pool";
import { getEthereumV4Pool } from "../uniswap/getEthereumV4Pool";
import { Bytes32HexSchema, EvmAddressSchema } from "../../schemas/primitives";
import { poolCardText, type PoolCardText } from "./poolCard";

/** A day: nothing on a card changes with the price. */
const CARD_TTL_MS = 86_400_000;

const kept = keptReads<PoolCardText | null>({
  name: "og-pool-card",
  ttlMs: CARD_TTL_MS,
  keep: (text) => text !== null,
});

/** For tests. */
export const forgetPoolCards = (): void => kept.forget();

/**
 * The text of a pool's card, from the address the card was asked for, or
 * `null` for anything that is not a pool this site reads — which the route
 * draws as the site's own card rather than as an error. Read once a day per
 * pool; a failed read is asked again.
 */
export const readPoolCard = (params: URLSearchParams): Promise<PoolCardText | null> => {
  const key = JSON.stringify([params.get("chain"), params.get("protocol"), params.get("id")?.toLowerCase()]);

  return kept.read(key, async () => {
    const chain = chainBySlug(params.get("chain") ?? "ethereum");
    const protocol = params.get("protocol");
    const id = params.get("id") ?? "";
    if (chain === null) return null;

    if (protocol === "v3" && readsV3(chain.id) && EvmAddressSchema.safeParse(id).success) {
      const pool = await getEthereumV3Pool(id, chain.id);
      return pool.status === "unavailable" ? null : poolCardText(pool.data);
    }
    if (protocol === "v4" && readsV4(chain.id) && Bytes32HexSchema.safeParse(id).success) {
      const pool = await getEthereumV4Pool(id, chain.id);
      return pool.status === "unavailable" ? null : poolCardText(pool.data);
    }

    return null;
  });
};
