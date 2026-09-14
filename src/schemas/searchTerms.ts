import { z } from "zod";

/*
 * What a visitor may search for.
 *
 * Apart from `poolSearch.ts`, where the results live, so that the one place that
 * has to classify a request *before* rendering begins — the rate-limiting proxy,
 * which runs on every matched request — can ask what a term is without pulling
 * in every pool contract behind it.
 */

/** Short enough to be a ticker fragment, long enough for the longest ticker. */
export const MIN_SEARCH_TERM_LENGTH = 2;
export const MAX_SEARCH_TERM_LENGTH = 16;

/** A pool has two sides, so two terms is everything a pool search can use. */
export const MAX_SEARCH_TERMS = 2;

/**
 * What a search term may be made of: letters in any script, digits, and the
 * three punctuation marks that turn up inside tickers.
 *
 * An allowlist rather than a denylist, because a term is shown back to the
 * reader. The categories left out are the ones a token label may not carry
 * either — control, format and unassigned code points — for the same reason:
 * each is a way for text to be something other than what it appears to be.
 *
 * This is not what keeps the upstream query well-formed. A term travels as a
 * GraphQL variable and is never spliced into query text, so a query is safe
 * whatever this allows.
 */
const SEARCH_TERM = /^[\p{L}\p{N}._+]+$/u;

export const PoolSearchTermSchema = z
  .string()
  .min(MIN_SEARCH_TERM_LENGTH, { error: "A search term this short matches almost everything." })
  .max(MAX_SEARCH_TERM_LENGTH, { error: "A search term this long matches nothing." })
  .refine((term) => SEARCH_TERM.test(term), {
    error: "A search term may hold letters, digits, and the marks that appear inside tickers.",
  });

/**
 * One term or two, written as a union of tuples rather than a bounded array.
 *
 * The bounds are the same either way; the difference is that a tuple says there
 * is a first term in the *type*, so every reader of a parsed value gets a string
 * rather than a `string | undefined` it has to guard against with a branch no
 * test could ever reach.
 */
export const PoolSearchTermsSchema = z.union([
  z.tuple([PoolSearchTermSchema]),
  z.tuple([PoolSearchTermSchema, PoolSearchTermSchema]),
]);

export type PoolSearchTerms = z.infer<typeof PoolSearchTermsSchema>;
