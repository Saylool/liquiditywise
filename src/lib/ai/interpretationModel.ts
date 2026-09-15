/*
 * Which model writes the explanations, and how much room it gets.
 *
 * The job is narrow — read verified figures, write four short paragraphs — so a
 * mid-tier model is the deliberate choice rather than a compromise. What keeps
 * that safe is not the tier but the output contract, which refuses a figure and
 * has nowhere to put a recommendation.
 */

/**
 * The models this application will use, with the prices checked against
 * OpenAI's pricing page on 2026-09-13, per million tokens.
 *
 * An allowlist rather than a free-text setting. A mistyped model name fails
 * every request with a 400 and reads like an outage; worse, a valid but
 * unintended name would quietly change what each analysis costs. Adding one is
 * a code change on purpose — it is the moment to look up what it charges.
 */
export const INTERPRETATION_MODELS = {
  /** $0.20 in / $1.20 out. */
  "gpt-5.6-luna": "gpt-5.6-luna",
  /** $2 in / $12 out — roughly a cent an analysis with this application's prompt. */
  "gpt-5.6-terra": "gpt-5.6-terra",
  /** $4 in / $20 out. */
  "gpt-5.6-sol": "gpt-5.6-sol",
  /** $10 in / $50 out. */
  "gpt-6-astra": "gpt-6-astra",
  /*
   * Older generations, kept because access to the current ones is not automatic:
   * a new key can be valid and still be refused a flagship model until the
   * account is funded or the organisation verified. These are the fallbacks that
   * distinguish "this key cannot use *that* model" from "this key cannot call
   * anything", which is the difference between a settings problem and a billing
   * one.
   */
  /** $0.25 in / $2 out. */
  "gpt-5-mini": "gpt-5-mini",
  /** $0.15 in / $0.60 out. */
  "gpt-4o-mini": "gpt-4o-mini",
} as const;

export type InterpretationModel = keyof typeof INTERPRETATION_MODELS;

export const DEFAULT_INTERPRETATION_MODEL: InterpretationModel = "gpt-5.6-terra";

export const isInterpretationModel = (value: unknown): value is InterpretationModel =>
  typeof value === "string" && Object.hasOwn(INTERPRETATION_MODELS, value);

/**
 * The model to use, given whatever the environment asked for.
 *
 * An unrecognised setting falls back to the default rather than failing. The
 * explanation is the one part of this page that is allowed to be missing, so a
 * typo in a setting should not be the thing that takes it away — and the
 * fallback is visible, because the page names the model that wrote the text.
 */
export const resolveInterpretationModel = (configured: string | undefined): InterpretationModel =>
  isInterpretationModel(configured) ? configured : DEFAULT_INTERPRETATION_MODEL;

/**
 * The output budget, sized for what the answer actually spends rather than for
 * what it prints.
 *
 * It was 2048, on the reasoning that four sections of a few hundred characters
 * are well under a thousand tokens. The prose is — but the prose is not what
 * fills this budget. These models think before they answer, and reasoning
 * tokens are charged to `max_output_tokens` alongside the text.
 *
 * Measured on one pool against gpt-5.6-luna: English spent 1466 output tokens,
 * 1034 of them reasoning; Turkish spent 1120, 516 of them reasoning. So the
 * visible answer was four to six hundred tokens either way, and the thinking was
 * one to two times that again — varying by a factor of two for the very same
 * task. At 2048 the headroom over the larger of those was under half, which is
 * not headroom at all when the variable part swings that far. Answers were
 * being cut off mid-sentence and refused, and the reader was shown nothing.
 *
 * Hitting this ceiling should mean something went wrong, not that the limit was
 * tight. At 4096 it is roughly three times the largest spend observed, and the
 * worst case costs a fraction of a cent at the prices above.
 */
export const INTERPRETATION_MAX_TOKENS = 4096;
