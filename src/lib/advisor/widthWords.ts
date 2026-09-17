import type { Dictionary } from "../i18n/dictionaries";
import { MULTIPLIER_CHOICES } from "./requestedParameters";

/**
 * A word for each offered width, in the order the widths are offered.
 *
 * "1σ" means nothing to most people; "tight" means something, and the sigma
 * stays beside it for the reader it does mean something to. The words are
 * relative to each other and to nothing else — none of them is a
 * recommendation, and the note under the form says the width is not a
 * confidence level. A width typed into the URL gets no word, because the
 * words were chosen for the offered widths and would mislead beside another.
 *
 * Shared by the form that offers the widths and the panel that compares
 * them, so a width is called the same thing wherever it appears.
 */
const WIDTH_WORDS = ["tight", "medium", "wide", "veryWide"] as const satisfies readonly (keyof Dictionary["parameters"]["widthWords"])[];

export const widthWord = (value: number, t: Dictionary): string | null => {
  const index = (MULTIPLIER_CHOICES as readonly number[]).indexOf(value);
  const key = WIDTH_WORDS[index];

  return key === undefined ? null : t.parameters.widthWords[key];
};
