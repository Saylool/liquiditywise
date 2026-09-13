/*
 * Which model writes the explanations, and how much room it gets.
 *
 * One place, because this is the setting most likely to change: the job is
 * narrow — read verified figures, write four short paragraphs — so a mid-tier
 * model is the deliberate choice rather than a compromise. What keeps that safe
 * is not the model tier but the output contract, which refuses a figure and has
 * nowhere to put a recommendation.
 */

/**
 * `gpt-5.6-terra`: the price/performance middle of the current range, at $2 per
 * million input tokens and $12 per million output. Measured against this
 * application's own prompt that is roughly a cent an analysis, and output
 * tokens are most of it — which is why the lever that matters is reusing an
 * answer for figures that have not changed, not shortening the prompt.
 */
export const INTERPRETATION_MODEL = "gpt-5.6-terra";

/**
 * Four sections capped at 700 characters each is well under a thousand tokens.
 * The ceiling is generous enough that a normal answer never reaches it, so
 * hitting it means something went wrong rather than that the limit was tight.
 */
export const INTERPRETATION_MAX_TOKENS = 2048;
