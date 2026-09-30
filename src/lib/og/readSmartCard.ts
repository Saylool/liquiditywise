import "server-only";

import { peekSmartLiquidity } from "../advisor/getSmartLiquidity";
import { chainBySlug, readsV3Positions } from "../chains/chains";
import { type SmartCardText, smartCardText } from "./smartCard";

/**
 * The text of the smart-money card for the chain it was asked for, or `null`
 * for a chain whose positions this site cannot list or one not measured yet —
 * which the route draws as the site's own card rather than as an error.
 *
 * Only what is kept: a card is fetched by crawlers and must never start a
 * measurement of a dozen pools.
 */
export const readSmartCard = (params: URLSearchParams): SmartCardText | null => {
  const chain = chainBySlug(params.get("chain") ?? "ethereum");
  if (chain === null || !readsV3Positions(chain.id)) return null;

  return smartCardText(peekSmartLiquidity(chain.id));
};
