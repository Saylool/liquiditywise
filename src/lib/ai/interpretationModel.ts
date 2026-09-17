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
   * a key can be valid and still be refused a newer model.
   *
   * They were described here as fallbacks that would distinguish a model-access
   * problem from a billing one. That is not what they do. Measured against this
   * project's own key, every model in this list except `gpt-5.6-luna` answers
   * 403 `model_not_found` — the older ones included — because an OpenAI project
   * can be scoped to an explicit list of models, and this one is scoped to a
   * single entry. An older model is not a lower bar; it is simply another name
   * that is either on the list or is not.
   */
  /** $0.25 in / $2 out. */
  "gpt-5-mini": "gpt-5-mini",
  /** $0.15 in / $0.60 out. */
  "gpt-4o-mini": "gpt-4o-mini",
} as const;

export type InterpretationModel = keyof typeof INTERPRETATION_MODELS;

/**
 * What runs when `OPENAI_MODEL` is unset or unrecognised.
 *
 * `resolveInterpretationModel` falls back rather than failing, so that a typo in
 * a setting is not the thing that takes the explanation away. That only works if
 * the fallback is a model the deployment can actually call — and it was not: the
 * default was `gpt-5.6-terra`, which this project's key is refused with a 403.
 * A mistyped setting would have produced exactly the outage the fallback exists
 * to prevent, and it would have read like the service being down.
 *
 * So the default is the one model measured to work here, which is also the
 * cheapest in the list above. A deployment whose key reaches further says so in
 * its own environment.
 */
export const DEFAULT_INTERPRETATION_MODEL: InterpretationModel = "gpt-5.6-luna";

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
 *
 * **Measured again on 2026-09-17**, after three increments had each added a
 * block to the model's brief — what a deposit would take of the fees, the two
 * one-sided halves of the range, and the hook material the directory shares.
 * Twenty-four calls, four pools of both protocols, both languages, three runs:
 * every answer landed, and the largest spend was 1101 tokens — 27% of this
 * budget, against the 36% the figures above describe. More to read did not turn
 * into more to think about.
 */
export const INTERPRETATION_MAX_TOKENS = 4096;

/**
 * How hard the model is asked to think before it writes.
 *
 * These models reason before answering, and on this task the reasoning was
 * most of the wait. Measured on 2026-09-17 against `gpt-5.6-luna`, the same
 * pool and the same prompt, three rounds each:
 *
 *   default effort   median 29.0 s, worst 39.9 s, 516 to 1034 reasoning tokens
 *   low effort       median 16.5 s, worst 19.8 s, 275 to  362 reasoning tokens
 *
 * The visible answer was the same length either way — about two thousand
 * characters — and reading them side by side, the low-effort text covered the
 * same four things and kept to the same rules. So the thinking was buying a
 * reader nothing and costing them half a minute.
 *
 * `minimal` is refused by this model with a 400, and `none` measured *slower*
 * than `low` in both languages despite spending no reasoning tokens at all,
 * which is not a thing to design around. `low` is the setting that was both
 * accepted and measurably faster.
 *
 * The job this sits under is narrow by construction: read figures that are
 * already verified, write four short paragraphs, and never produce a number.
 * The output contract enforces the last part whatever the effort.
 */
export const INTERPRETATION_REASONING_EFFORT = "low";

/**
 * How long one attempt at an explanation may take.
 *
 * The SDK's own default is ten minutes, which is not a budget: a provider
 * having a bad minute would hold the page's last section open long past the
 * point where a reader has given up and the platform has killed the function.
 *
 * Forty-five seconds is more than twice the worst answer measured at the
 * effort above. It is longer than any other budget here because this is the
 * one read whose work is genuinely open-ended, and because the section streams
 * into a boundary of its own: a slow explanation costs a reader a pending
 * panel under a page they can already read in full.
 *
 * Still true on 2026-09-17, over the twenty-four calls described above: English
 * answers took 7.6 to 9.8 seconds, Turkish 8.1 to 11.7. The worst is a quarter
 * of this budget, which is the margin a provider having a bad minute needs.
 */
export const INTERPRETATION_TIMEOUT_MS = 45_000;

/**
 * How many times one attempt may be repeated.
 *
 * The SDK retries twice by default, which is the wrong shape when an attempt
 * can take forty-five seconds: three of them is over two minutes to arrive at
 * a failure. One retry is what rescues the case worth rescuing — a rate limit
 * or a 500 that clears immediately — and the answer is cached for an hour once
 * it lands, so a reader rarely pays even the first attempt.
 */
export const INTERPRETATION_MAX_RETRIES = 1;
