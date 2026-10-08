import {
  type RangeInterpretation,
  TOKEN_A_PLACEHOLDER,
  TOKEN_PLACEHOLDER_PATTERN,
} from "../../schemas";
import { SECTION_KEYS, type SectionKey } from "./interpretationSections";

/*
 * Puts the tokens' symbols into prose the model wrote with placeholders.
 *
 * The last step before a reader sees the explanation, and deliberately after
 * every check: the prose has already been held to the whole contract —
 * no figure, no stray placeholder, no advice — in the form the model wrote it.
 * A symbol is then put in by this code and not by the model, so it is checked
 * by none of those rules, and does not need to be: it is the same label the
 * page prints beside every price, in the same way, and the label schema has
 * already refused one that is not a label at all. "1INCH" holds a digit and is
 * still the token's name; the numeral rule is about figures the model states.
 *
 * Plain text in, plain text out. The page renders the explanation as a React
 * text node, which escapes it on the way to HTML exactly as it escapes the
 * symbol everywhere else on the page — so escaping it here as well would show
 * a reader "&amp;" for a token called "A&B". A future consumer that writes
 * HTML by hand owes the escape itself, as it would for any other string.
 *
 * One pass over the prose, never one per token. A symbol that itself reads
 * "{TOKEN_B}" is written out as those characters and not substituted again —
 * the replacement is never re-scanned — so no token can reach into the
 * sentence and rename the other one.
 */

export type TokenSymbols = {
  /** The pool's first token, which the model calls `{TOKEN_A}`. */
  readonly token0: string;
  /** The pool's second token, which the model calls `{TOKEN_B}`. */
  readonly token1: string;
};

/** One paragraph, with both placeholders replaced in a single pass. */
export const withTokenSymbols = (prose: string, symbols: TokenSymbols): string =>
  prose.replace(TOKEN_PLACEHOLDER_PATTERN, (placeholder) =>
    placeholder === TOKEN_A_PLACEHOLDER ? symbols.token0 : symbols.token1,
  );

/**
 * Every section of a verified explanation, by the schema's own list of them so
 * a section added there is never left holding a placeholder. `method` is this
 * application's own label and is left alone.
 */
export const interpretationWithTokenSymbols = (
  interpretation: RangeInterpretation,
  symbols: TokenSymbols,
): RangeInterpretation => ({
  ...interpretation,
  ...Object.fromEntries(
    SECTION_KEYS.map((key) => [key, withTokenSymbols(interpretation[key], symbols)]),
  ),
});

/** The same, for a paragraph handed on early while the rest is still arriving. */
export const sectionWithTokenSymbols =
  (onSection: (key: SectionKey, prose: string) => void, symbols: TokenSymbols) =>
  (key: SectionKey, prose: string): void => {
    onSection(key, withTokenSymbols(prose, symbols));
  };
