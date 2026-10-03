import { type Chain, chainBySlug, ETHEREUM, readsV3, readsV4 } from "../chains/chains";
import { isLocale, type Locale } from "../i18n/locales";
import { Bytes32HexSchema, EvmAddressSchema } from "../../schemas/primitives";

/*
 * What an embedded pool card was asked for, read from its address.
 *
 *   /embed/pool?address=0x88e6…                 a v3 pool on mainnet
 *   /embed/pool?chain=base&address=0xd0b5…      a v3 pool on Base
 *   /embed/pool?chain=unichain&id=0x3258…       a v4 pool on Unichain
 *   …&lang=tr                                   the card in Turkish
 *
 * The same parameters the site's own pool pages take, under one path: a v3
 * pool is named by its `address` as on /pool, a v4 pool by its `id` as on
 * /v4, and the chain goes unsaid on mainnet, as in every link. Which of the
 * two names arrived says which protocol it is, so there is no third parameter
 * to disagree with it — a 20-byte address and a 32-byte id cannot be
 * mistaken for each other. The JSON at /api/embed/pool reads the same.
 *
 * Stricter than the pages, because a card has no form to show a mistake
 * beside: anything other than exactly one well-formed pool name, on one chain
 * this site reads that protocol on, is refused before anything is read. A
 * repeated parameter is refused rather than having one of its values picked.
 *
 * Pure and framework-free, so the proxy can read the card's language with it.
 * Imports reach past the schema barrel for the reason chargeableRequest.ts
 * gives: this runs on every matched request.
 */

export type EmbedRequest = {
  readonly protocol: "v3" | "v4";
  readonly chain: Chain;
  /** Lower case, as every pool is named here. */
  readonly poolId: string;
};

/** The one value of a parameter, `undefined` when absent, and `null` when it was repeated. */
const single = (parameters: URLSearchParams, name: string): string | null | undefined => {
  const values = parameters.getAll(name);
  if (values.length === 0) return undefined;
  return values.length === 1 ? (values[0] ?? null) : null;
};

/** The pool a card names, or `null` for anything this site would not read for it. */
export const readEmbedRequest = (parameters: URLSearchParams): EmbedRequest | null => {
  const slug = single(parameters, "chain");
  if (slug === null) return null;
  const chain = slug === undefined ? ETHEREUM : chainBySlug(slug);
  if (chain === null) return null;

  const address = single(parameters, "address");
  const id = single(parameters, "id");
  if (address === null || id === null) return null;
  /* Both, or neither, is not one pool. */
  if ((address === undefined) === (id === undefined)) return null;

  if (address !== undefined) {
    const parsed = EvmAddressSchema.safeParse(address);
    return parsed.success && readsV3(chain.id) ? { protocol: "v3", chain, poolId: parsed.data } : null;
  }
  const parsed = Bytes32HexSchema.safeParse(id);
  return parsed.success && readsV4(chain.id) ? { protocol: "v4", chain, poolId: parsed.data } : null;
};

/**
 * The card's language: what `lang` names, when it names one the site is
 * published in, and English otherwise.
 *
 * From the address alone, never from a cookie or the reader's browser. The
 * site that embeds the card chooses its language, the same card is the same
 * response for everyone who loads it — which is what lets a cache in front
 * keep it — and a cookie set by this site is, inside somebody else's page, a
 * third-party cookie most browsers no longer send.
 */
export const readEmbedLocale = (parameters: URLSearchParams): Locale => {
  const lang = single(parameters, "lang");
  return isLocale(lang) ? lang : "en";
};
