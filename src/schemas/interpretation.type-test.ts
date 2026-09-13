import type { z } from "zod";

import type {
  RangeInterpretationSections,
  RangeInterpretationWireSchema,
} from "./interpretation";

/*
 * Compile-time only. Nothing here runs; `tsc` failing is the whole test.
 *
 * Two schemas describe what the model writes: the real one, which carries the
 * rules, and the wire one, which is what the provider is asked to produce. They
 * must always name exactly the same sections — one added to either and
 * forgotten in the other would be requested and never checked, or checked and
 * never requested.
 *
 * `method` appears in neither: it is this application's own label, attached
 * after the model's answer has been verified.
 */

type WireFields = keyof z.infer<typeof RangeInterpretationWireSchema>;
type RealFields = keyof RangeInterpretationSections;

/** Resolves to `never` unless the two are the same set of keys. */
type MustMatch<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const fieldsMatch: MustMatch<WireFields, RealFields> = true;

export type { WireFields, RealFields };
export { fieldsMatch };
