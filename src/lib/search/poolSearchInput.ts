import { EvmAddressSchema, type EvmAddress } from "../../schemas/primitives";
import {
  MAX_SEARCH_TERMS,
  PoolSearchTermSchema,
  type PoolSearchTerms,
} from "../../schemas/searchTerms";

/*
 * What a visitor typed into the search box, classified.
 *
 * Pure, and the only module that reads the raw string. Until this feature the
 * single thing a visitor could supply was a pool address, matched against a hex
 * pattern before anything happened; a search box is the first free text this
 * application accepts, so what may come out of it is decided in one place rather
 * than checked again at each use.
 *
 * What a *term* may be is not decided here — that is `PoolSearchTermSchema`,
 * beside the results it ends up inside. This module only takes a string apart.
 */

/**
 * What separates one term from another: whitespace and the characters people
 * write a pair with.
 *
 * `-` is here and `+`, `.` and `_` are not. Pairs get written "WETH-USDC" far
 * more often than a ticker carries a hyphen, and a hyphenated ticker is still
 * reachable because the source matches on a substring. The others appear inside
 * real tickers often enough that splitting on them would break more searches
 * than it fixed.
 */
const SEPARATORS = /[\s/,&|-]+/u;

/** Why a search could not be run. Each maps to one sentence in the interface. */
export type PoolSearchRejection = "empty" | "length" | "unsupported-characters";

export type PoolSearchInput =
  /** A pool address. There is nothing to search for: that pool can be analysed. */
  | { readonly kind: "address"; readonly address: EvmAddress }
  | { readonly kind: "terms"; readonly terms: PoolSearchTerms }
  | { readonly kind: "unusable"; readonly reason: PoolSearchRejection };

const unusable = (reason: PoolSearchRejection): PoolSearchInput => ({ kind: "unusable", reason });

/**
 * Separates a term the schema refused for its length from one it refused for
 * what it is made of, so the interface can say which.
 *
 * The distinction is worth keeping: "that is too short" tells someone what to do
 * next, and "that cannot be searched for" does not.
 */
const rejectionFor = (term: string): PoolSearchRejection | null => {
  const parsed = PoolSearchTermSchema.safeParse(term);
  if (parsed.success) return null;

  return parsed.error.issues.some((issue) => issue.code === "too_small" || issue.code === "too_big")
    ? "length"
    : "unsupported-characters";
};

/**
 * Reads one raw search string.
 *
 * A term that fails a rule refuses the whole search rather than being quietly
 * dropped. A reader who typed one thing and was shown results for another has
 * been told something untrue about what was searched, which is worse than being
 * told the search could not be run.
 *
 * A third term is the exception, and is dropped rather than refused: "weth usdc
 * 0.05%" is a reasonable thing to type, a pool has nowhere to put a third term,
 * and the page names the terms it actually used.
 */
export const readPoolSearchInput = (raw: string): PoolSearchInput => {
  const trimmed = raw.trim();
  if (trimmed === "") return unusable("empty");

  const address = EvmAddressSchema.safeParse(trimmed);
  if (address.success) return { kind: "address", address: address.data };

  const pieces = trimmed.split(SEPARATORS).filter((piece) => piece !== "");
  const [first, second] = pieces.slice(0, MAX_SEARCH_TERMS);
  if (first === undefined) return unusable("empty");

  for (const term of second === undefined ? [first] : [first, second]) {
    const rejection = rejectionFor(term);
    if (rejection !== null) return unusable(rejection);
  }

  return { kind: "terms", terms: second === undefined ? [first] : [first, second] };
};
