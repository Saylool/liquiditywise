/*
 * A dictionary that is not finished yet, made whole with English.
 *
 * Seven languages are published and two of them have been written out in full.
 * The other five carry their interface — menus, buttons, panel titles, the
 * short labels a reader navigates by — and fall back to English for the long
 * explanations, which are the slowest part to translate well and the worst part
 * to translate badly.
 *
 * **Falling back is not the same as pretending.** The type still demands every
 * key, so nothing can render empty; what changes is where the value comes from.
 * The interface says, in the reader's own language, that the longer text is
 * still English — see `FULLY_TRANSLATED` next door. A reader who is told that
 * can decide; a reader who meets it halfway down a paragraph cannot.
 */

/**
 * Optional all the way down, except where a value is not an object to descend
 * into.
 *
 * Functions and arrays are left whole. A dictionary's functions take arguments
 * and interpolate them, so half of one is not a thing; an array is a list whose
 * length carries meaning, so a partial one would silently shorten it.
 */
export type DeepPartial<Shape> = {
  readonly [Key in keyof Shape]?: Shape[Key] extends (...args: never[]) => unknown
    ? Shape[Key]
    : Shape[Key] extends readonly unknown[]
      ? Shape[Key]
      : Shape[Key] extends object
        ? DeepPartial<Shape[Key]>
        : Shape[Key];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof value !== "function";

/**
 * Fills the gaps in a partial dictionary from a complete one.
 *
 * Descends only into plain objects: a translated function replaces the English
 * function whole, and so does a translated array. `undefined` means "not
 * translated yet" and takes the complete side's value — which is why a
 * translation that genuinely wants an empty string must write one.
 */
export const withFallback = <Shape extends Record<string, unknown>>(
  complete: Shape,
  partial: DeepPartial<Shape>,
): Shape => {
  const merged: Record<string, unknown> = { ...complete };

  for (const [key, value] of Object.entries(partial as Record<string, unknown>)) {
    if (value === undefined) continue;

    const original = complete[key];
    merged[key] =
      isPlainObject(value) && isPlainObject(original) ? withFallback(original, value) : value;
  }

  return merged as Shape;
};
