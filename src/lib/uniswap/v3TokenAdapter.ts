import { EvmAddressSchema } from "../../schemas";
import { convertSafeInteger } from "./v3SubgraphRawResponse";

/*
 * Turning one raw `Token` entity into the domain shape.
 *
 * Shared rather than restated, unlike the chain-id constant each adapter
 * declares for itself. That is a literal `1` that cannot drift into being wrong;
 * this decides what a token has to satisfy before this application will carry
 * it, and two copies of that would be two places to fix a gap in.
 */

/** The raw `Token` fields every v3 query in this application selects. */
export type RawV3Token = {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: string;
};

export type NormalizedV3Token = {
  readonly chainId: number;
  readonly address: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly name?: string;
};

/**
 * Normalizes one raw token, or returns `null` if it cannot be trusted.
 *
 * `name` is dropped when the provider reports an empty string. The domain treats
 * a name as optional, and an empty string is not a name — carrying it through
 * would turn "this token has no name on-chain" into a token literally called "".
 * `symbol` gets no such leniency: it is required, so an empty one fails the
 * schema and the whole response with it.
 *
 * What a symbol or a name may *contain* is not decided here. That is the domain
 * schema's business, and leaving it there means a token cannot reach a page by
 * way of some adapter that forgot to ask.
 */
export const normalizeV3Token = (raw: RawV3Token, chainId: number): NormalizedV3Token | null => {
  const decimals = convertSafeInteger(raw.decimals);
  if (!decimals.ok) return null;

  const address = EvmAddressSchema.safeParse(raw.id);
  if (!address.success) return null;

  return {
    chainId,
    address: address.data,
    symbol: raw.symbol,
    decimals: decimals.value,
    ...(raw.name === "" ? {} : { name: raw.name }),
  };
};
