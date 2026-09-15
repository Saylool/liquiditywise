import { z } from "zod";

/*
 * What the model is allowed to hand back.
 *
 * This is the narrowest contract in the project, and deliberately so. Everything
 * below it — pool facts, volatility, the band, the tick range — is computed,
 * cross-checked against the chain, and re-derived by its own schema. The model
 * arrives at the very end with one job: say what those figures mean in ordinary
 * language.
 *
 * Two rules give that job hard edges.
 *
 * **The model states no figures.** Every number a reader sees is rendered by the
 * interface from verified data; the prose refers to them rather than repeating
 * them. This removes the most damaging failure available to a language model
 * here — quoting a number that is subtly wrong, in a paragraph that reads as
 * authoritative — by removing the opportunity rather than by checking for it
 * afterwards. It is enforced below, not merely requested in a prompt.
 *
 * **The fields are descriptive, not prescriptive.** There is no risk level, no
 * confidence, no recommendation and no score. A field named `riskLevel` would
 * invite the model to fill it, and an educational tool that grades a position
 * has started giving advice whatever its disclaimer says. What the schema cannot
 * enforce is tone — a section can still be written as a suggestion — so that
 * part is the prompt's responsibility, and this comment is not pretending
 * otherwise.
 */

/** Names the interpretation model, so two written differently are never mixed. */
export const INTERPRETATION_METHOD = "verified-figures-plain-language-explanation";

/**
 * Protocol version names read as digits to a regular expression but are not
 * figures — "Uniswap v3" has to remain writable. Nothing else is exempt.
 */
const PROTOCOL_VERSION = /\bv[34]\b/gi;

const containsFigure = (prose: string): boolean => /\d/.test(prose.replace(PROTOCOL_VERSION, ""));

/**
 * The most characters one section may run to.
 *
 * Sized for the longest language the interface publishes, not for English.
 *
 * It was 700, which is comfortable in English and is not in Turkish. Measured
 * against the live model on one pool, the same four sections came back at
 * 392/333/479/518 characters in English and 471/297/710/653 in Turkish — the
 * same content running twenty to fifty per cent longer. The Turkish answer was
 * rejected whole for one section being ten characters over, and the reader was
 * shown "no explanation" instead of a good one.
 *
 * That is the bound doing the opposite of its job. It exists to catch a model
 * that has stopped cooperating, not to style-edit a cooperative one, and a
 * bound only one of two published languages can meet is a bug in the bound.
 */
const MAX_SECTION_CHARACTERS = 900;

/**
 * One section of the explanation.
 *
 * The lower bound rejects a one-line answer that says nothing; the upper bound
 * rejects an essay that buries the point. Both are generous — the intent is to
 * catch a model that has stopped cooperating, not to style-edit it.
 */
const ProseSchema = z
  .string()
  .trim()
  .min(60, { error: "A section this short does not explain anything." })
  .max(MAX_SECTION_CHARACTERS, { error: "A section this long belongs in several." })
  .refine((prose) => !containsFigure(prose), {
    error:
      "The explanation must not state figures. Refer to the values shown alongside it instead.",
  });

/**
 * What the model actually writes: four sections of prose and nothing else.
 *
 * `method` is deliberately absent. It labels which kind of analysis produced
 * the text, which is this application's statement about its own pipeline, not
 * something a model could know or should be asked to assert. Leaving it in the
 * model's output meant either telling it a magic string to copy — inviting it
 * to get that wrong in a way that discards an otherwise good answer — or, as
 * happened, not telling it at all and rejecting every answer for a field nobody
 * had explained.
 */
export const RangeInterpretationSectionsSchema = z.strictObject({
  /** What the suggested range covers, in ordinary language. */
  whatThisRangeMeans: ProseSchema,
  /** The mechanic a reader needs: what happens when price moves outside it. */
  ifPriceLeavesTheRange: ProseSchema,
  /** What the volatility figure is measuring, and what it is not. */
  whatTheVolatilitySays: ProseSchema,
  /** The limits — costs, risks and effects this analysis does not model at all. */
  whatThisDoesNotCover: ProseSchema,
});

export type RangeInterpretationSections = z.infer<typeof RangeInterpretationSectionsSchema>;

/** The sections, labelled by this application with the model of analysis they explain. */
export const RangeInterpretationSchema = RangeInterpretationSectionsSchema.extend({
  method: z.literal(INTERPRETATION_METHOD),
});

export type RangeInterpretation = z.infer<typeof RangeInterpretationSchema>;

/**
 * The same shape, with every rule stripped out — this is what the provider is
 * told to produce.
 *
 * Providers differ in which JSON Schema keywords they accept under a strict
 * output format, and a keyword one of them rejects fails the whole request. So
 * the wire schema carries only what every provider agrees on: the field names,
 * their types, and that nothing else may appear. The bounds and the fixed label
 * are checked here on the way back, where they are enforced rather than merely
 * requested.
 *
 * Sending the rules as well would buy nothing — a constraint the provider
 * enforces is still re-checked on arrival, because the day a provider quietly
 * stops enforcing it is not a day this application would notice.
 *
 * `interpretation.type-test.ts` fails the build if the two drift apart.
 */
export const RangeInterpretationWireSchema = z.strictObject({
  whatThisRangeMeans: z.string(),
  ifPriceLeavesTheRange: z.string(),
  whatTheVolatilitySays: z.string(),
  whatThisDoesNotCover: z.string(),
});
