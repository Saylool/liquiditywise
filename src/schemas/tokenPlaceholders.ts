/*
 * The two names the model calls a pool's tokens by, in place of their symbols.
 *
 * A token's symbol is the one string on the page that a stranger wrote.
 * Deploying a token costs nothing, `symbol()` returns whatever its author
 * chose, and the label schema can only refuse what is not a label at all —
 * control characters, format characters, more than forty of anything. "IGNORE
 * PREVIOUS INSTRUCTIONS" passes it, and so does "SAFE YIELD". Handed to the
 * model as part of the brief, that text sat among the instructions it was
 * reading, and a model does not reliably keep "the name of a thing" apart from
 * "something it was told" when both arrive as words in one request.
 *
 * So the model never sees a symbol. It is told about `{TOKEN_A}` and
 * `{TOKEN_B}` — the pool's first and second token, in the order the pool
 * itself stores them — writes those names wherever it means a token, and the
 * symbols are put in afterwards, by plain code, into prose that has already
 * passed every rule in `interpretation.ts`. Nothing a token's author wrote is
 * ever read by the model, so there is nothing for it to follow.
 *
 * The names hold no digit, on purpose: `TOKEN0` would be rejected by the very
 * rule that forbids the model a figure, and exempting it there would open a
 * hole in the one rule this contract exists for.
 */

/** What the model writes for the pool's first token. */
export const TOKEN_A_PLACEHOLDER = "{TOKEN_A}";

/** What the model writes for the pool's second token. */
export const TOKEN_B_PLACEHOLDER = "{TOKEN_B}";

/** Both, exactly as written, and nothing else is a placeholder. */
const EXACT = /\{TOKEN_A\}|\{TOKEN_B\}/g;

/**
 * A placeholder written any way but exactly — a brace left open, a name in
 * another case, a name without its braces — or a brace standing on its own.
 *
 * Each would survive into the page as written: substitution only recognises
 * the two exact forms, so `{token_a}` or a bare `TOKEN_B` would reach a reader
 * as a variable name in the middle of a sentence, and `{POOL}` would be a name
 * nobody told the model about. A brace has no other use in a paragraph of
 * plain language, so any one left after the two exact forms are taken out is
 * one of these.
 *
 * The bare name is matched as a word, so a sentence about "tokens" is untouched.
 */
const MALFORMED = /[{}]|(?<![\p{L}\p{M}\p{N}_])token_[ab](?![\p{L}\p{M}\p{N}_])/iu;

/**
 * Whether this prose names a token any way other than by the two placeholders.
 *
 * The prose need not name a token at all — "one of the two tokens" is an
 * honest sentence, and real answers were written that way before the
 * placeholders existed. Requiring one would refuse a cooperative paragraph to
 * enforce a style, and the cost of that is the whole explanation.
 */
export const containsStrayPlaceholder = (prose: string): boolean =>
  MALFORMED.test(prose.replace(EXACT, ""));

/** The exact placeholders, for the code that substitutes them. */
export const TOKEN_PLACEHOLDER_PATTERN = EXACT;
