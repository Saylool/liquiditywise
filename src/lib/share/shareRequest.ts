import { type Chain, chainBySlug, ETHEREUM, readsV3Positions, type V3PositionChainId } from "../chains/chains";
import { UnsignedIntegerStringSchema } from "../../schemas/primitives";

/*
 * What a share card was asked for, read from its address.
 *
 *   /api/share/position?id=998651                 a v3 position on mainnet
 *   /api/share/position?chain=base&id=12345       a v3 position on Base
 *   …&lang=tr                                     the card in Turkish
 *
 * A v3 position is named by its token id, the decimal the manager numbers it
 * by and the holdings page shows nothing else of; the chain goes unsaid on
 * mainnet, as in every link. The language is read as the embeddable card's is
 * (embed/embedRequest.ts), from the address alone.
 *
 * Stricter than the pages, for the same reason the embeddable card is: there
 * is no form to show a mistake beside. Anything other than exactly one
 * well-formed id, on one chain whose positions this site keeps a history of
 * (chains.ts: a record is verified nowhere else, so a card can be drawn
 * nowhere else), is refused before anything is read. A repeated parameter is
 * refused rather than having one of its values picked.
 *
 * Pure and framework-free, so the proxy can decide what to charge with it.
 */

export type ShareRequest = {
  readonly chain: Chain;
  readonly chainId: V3PositionChainId;
  /** The position's token id, as an exact decimal string. */
  readonly tokenId: string;
};

/** Every parameter the card's address is read with, in the order the developers page lists them. */
export const SHARE_PARAMETERS = ["id", "chain", "lang"] as const;

export type ShareParameter = (typeof SHARE_PARAMETERS)[number];

/** The one value of a parameter, `undefined` when absent, and `null` when it was repeated. */
const single = (parameters: URLSearchParams, name: string): string | null | undefined => {
  const values = parameters.getAll(name);
  if (values.length === 0) return undefined;
  return values.length === 1 ? (values[0] ?? null) : null;
};

/** The position a card names, or `null` for anything this site would not draw one for. */
export const readShareRequest = (parameters: URLSearchParams): ShareRequest | null => {
  const slug = single(parameters, "chain");
  if (slug === null) return null;
  const chain = slug === undefined ? ETHEREUM : chainBySlug(slug);
  if (chain === null || !readsV3Positions(chain.id)) return null;

  const id = single(parameters, "id");
  if (id === null || id === undefined) return null;
  const parsed = UnsignedIntegerStringSchema.safeParse(id);

  return parsed.success ? { chain, chainId: chain.id, tokenId: parsed.data } : null;
};
