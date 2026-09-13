/*
 * Which model writes the explanations, and how much room it gets.
 *
 * One place, because this is the setting most likely to change: the job is
 * narrow — read verified figures, write four short paragraphs — so a mid-tier
 * model is the deliberate choice rather than a compromise. What keeps that safe
 * is not the model tier but the output contract, which refuses a figure and has
 * nowhere to put a recommendation.
 */

/** Claude Sonnet 5: the price/performance middle of the current range. */
export const INTERPRETATION_MODEL = "claude-sonnet-5";

/**
 * Four sections capped at 700 characters each is well under a thousand tokens.
 * The ceiling is generous enough that a normal answer never reaches it, so
 * hitting it means something went wrong rather than that the limit was tight.
 */
export const INTERPRETATION_MAX_TOKENS = 2048;
