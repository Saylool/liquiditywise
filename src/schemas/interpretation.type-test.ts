import type { z } from "zod";

import type { RangeInterpretation, RangeInterpretationWireSchema } from "./interpretation";

/*
 * Compile-time only. Nothing here runs; `tsc` failing is the whole test.
 *
 * Two schemas describe the interpretation: the real one, which carries the rules,
 * and the wire one, which is what a provider is asked to produce. They must
 * always name exactly the same fields — a section added to one and forgotten in
 * the other would be requested and never checked, or checked and never
 * requested.
 */

type WireFields = keyof z.infer<typeof RangeInterpretationWireSchema>;
type RealFields = keyof RangeInterpretation;

/** Resolves to `never` unless the two are the same set of keys. */
type MustMatch<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const fieldsMatch: MustMatch<WireFields, RealFields> = true;

export type { WireFields, RealFields };
export { fieldsMatch };
