import { RangeInterpretationSectionsSchema } from "../../schemas";

/*
 * Reading one finished paragraph out of an answer that is still being written.
 *
 * The model writes its four sections into one JSON object, in the order the
 * schema declares them, and the provider sends that object as it is produced.
 * A section is finished the moment its closing quote arrives — everything after
 * that belongs to the next one — so the page need not wait for the last
 * paragraph to show the first.
 *
 * **Nothing is released unverified.** A section that has arrived is checked
 * against the very rule the whole answer is checked against later: the same
 * `ProseSchema`, taken from the same shape, so a paragraph shown early and the
 * same paragraph shown after the answer completes have passed the identical
 * test. What the early path cannot do is refuse the *rest* of an answer on
 * account of a later section — and it does not need to: each section stands or
 * falls on its own, because every rule in that schema is about one section.
 */

/**
 * The order the sections are read in: what the range is, what happens when it
 * ends, what the measurement behind it means, and what none of it covers.
 *
 * Taken from the schema's own shape rather than written out again, so a section
 * added there appears here — and in the order the model was told to write them,
 * which is the order they arrive in.
 */
export const SECTION_KEYS = Object.keys(
  RangeInterpretationSectionsSchema.shape,
) as readonly SectionKey[];

export type SectionKey = keyof typeof RangeInterpretationSectionsSchema.shape;

/**
 * The finished value of one field of a JSON object that is still arriving, or
 * `null` while it is not finished.
 *
 * Hand-written rather than handed to a tolerant JSON parser, because the
 * question is narrower than parsing: has *this* string ended? A quote counts as
 * the end only when it is not escaped, which is what the backslash skip is for
 * — a paragraph containing a quotation mark arrives as `\"` and would otherwise
 * be cut in half. The slice is then given to `JSON.parse`, so every other
 * escape a provider may emit is unescaped by the platform rather than by hand.
 */
export const completedSection = (partial: string, key: string): string | null => {
  const keyAt = partial.indexOf(`"${key}"`);
  if (keyAt === -1) return null;

  const colonAt = partial.indexOf(":", keyAt + key.length + 2);
  if (colonAt === -1) return null;

  const opening = partial.indexOf('"', colonAt + 1);
  if (opening === -1) return null;

  for (let index = opening + 1; index < partial.length; index += 1) {
    if (partial[index] === "\\") {
      index += 1;
      continue;
    }
    if (partial[index] !== '"') continue;

    try {
      const value: unknown = JSON.parse(partial.slice(opening, index + 1));
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }

  return null;
};

/**
 * One section, checked against the rule the whole answer is checked against.
 *
 * `null` for a paragraph that breaks it — a figure stated, or a length that
 * says the model has stopped cooperating. The early path then shows nothing
 * for that section and the answer is refused as a whole when it completes, as
 * it always was.
 */
export const verifiedSection = (key: SectionKey, prose: string): string | null => {
  const checked = RangeInterpretationSectionsSchema.shape[key].safeParse(prose);

  return checked.success ? checked.data : null;
};

/**
 * Every section that has both finished and passed its rule, given the text so
 * far. Sections already delivered are named in `delivered` and skipped.
 */
export const newlyFinishedSections = (
  partial: string,
  delivered: ReadonlySet<string>,
): readonly { readonly key: SectionKey; readonly prose: string }[] => {
  const finished: { key: SectionKey; prose: string }[] = [];

  for (const key of SECTION_KEYS) {
    if (delivered.has(key)) continue;
    const prose = completedSection(partial, key);
    if (prose === null) continue;
    const verified = verifiedSection(key, prose);
    if (verified === null) continue;
    finished.push({ key, prose: verified });
  }

  return finished;
};
