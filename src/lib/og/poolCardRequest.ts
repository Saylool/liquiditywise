import { type Chain, chainBySlug, ETHEREUM, readsV3, readsV4 } from "../chains/chains";
import { Bytes32HexSchema, EvmAddressSchema } from "../../schemas/primitives";

/*
 * What a shared pool link's card was asked for, read from its address.
 *
 *   /og/pool?protocol=v3&id=0x88e6…                 a v3 pool on mainnet
 *   /og/pool?protocol=v4&id=0x3258…&chain=unichain  a v4 pool on Unichain
 *
 * The address poolCard.ts writes into a pool page's metadata, read back. Apart
 * from the reader that draws it (readPoolCard.ts) because that one is
 * server-only and this is the rule: the proxy decides with it whether a card
 * request is charged against the caller's allowance, and the route decides
 * with it whether anything is read at all — the same function, so a request
 * the proxy let through uncharged is one the route answers without a single
 * upstream call.
 *
 * Strict in the way the embeddable card is (embed/embedRequest.ts): anything
 * other than one protocol, one well-formed pool name for it, on one chain this
 * site reads that protocol on, is not a pool here, and a repeated parameter is
 * refused rather than having one of its values picked. A card that cannot be
 * read is drawn as the site's own, so refusing costs a sharer nothing.
 *
 * Pure and framework-free. Imports reach past the schema barrel for the reason
 * chargeableRequest.ts gives: this runs on every matched request.
 */

export type PoolCardRequest = {
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
export const readPoolCardRequest = (parameters: URLSearchParams): PoolCardRequest | null => {
  const slug = single(parameters, "chain");
  if (slug === null) return null;
  const chain = slug === undefined ? ETHEREUM : chainBySlug(slug);
  if (chain === null) return null;

  const protocol = single(parameters, "protocol");
  const id = single(parameters, "id");
  if (typeof id !== "string") return null;

  if (protocol === "v3") {
    const parsed = EvmAddressSchema.safeParse(id);
    return parsed.success && readsV3(chain.id) ? { protocol, chain, poolId: parsed.data } : null;
  }
  if (protocol === "v4") {
    const parsed = Bytes32HexSchema.safeParse(id);
    return parsed.success && readsV4(chain.id) ? { protocol, chain, poolId: parsed.data } : null;
  }

  return null;
};

/** One key per pool, however its address was spelled: what the card is kept under. */
export const poolCardKey = ({ protocol, chain, poolId }: PoolCardRequest): string => `${protocol}@${chain.slug}:${poolId}`;
