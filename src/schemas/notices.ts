import { z } from "zod";

/*
 * What this application is allowed to tell a reader about a read that did not
 * go well.
 *
 * These used to be English sentences, written where they were raised and carried
 * out to the page verbatim. That worked while the interface had one language. It
 * stopped working the day it had two: a Turkish reader was told, in English, on
 * every single analysis, that rolling volume was unavailable — and would have
 * been told in English that their address was malformed, or that the source was
 * rate limited, at the exact moment a sentence has to land.
 *
 * So a notice is a code. The sentence lives in the dictionary beside every other
 * string the interface says, in each published language, and the code is what
 * travels. Three things follow from that, and all three are why it is worth the
 * churn:
 *
 *   - **A code cannot leak.** `DataResult` already promised its message carried
 *     no key, no URL and no provider text, and that promise was kept by everyone
 *     who ever wrote one. A fixed set of identifiers keeps it by construction.
 *   - **Nothing can go untranslated.** `Dictionary` is inferred from the English
 *     entry, so Turkish fails the build until it covers every code here.
 *   - **The wording stops being the data layer's business.** An adapter says what
 *     happened. What a reader is told about it is the interface's decision, and
 *     it can now be changed without touching a single read.
 *
 * Codes are grouped by where they are raised and named for what happened, never
 * for what the interface should say — that would put the wording back here in a
 * different spelling.
 */

/**
 * A read that produced nothing.
 *
 * Finer-grained than `DataFailureReason`, which stays as it was: several of
 * these share one reason, because a reason is what code branches on and a notice
 * is what a person reads. `invalid-response` alone covers a malformed payload,
 * an indexing error and a tick that disagrees with its own price — one branch,
 * three very different things to be told.
 */
export const DataFailureNoticeSchema = z.enum([
  /* What the visitor supplied. */
  "invalid-pool-address",
  "invalid-search-terms",

  /* What this deployment is missing. */
  "market-data-not-configured",
  "chain-data-not-configured",
  "explanation-not-configured",

  /* The market data source: The Graph. */
  "market-data-timed-out",
  "market-data-unreachable",
  "market-data-credentials-rejected",
  "market-data-rate-limited",
  "market-data-unreadable",
  "market-data-malformed",
  "market-data-indexing-errors",
  "market-data-stale",
  "market-data-future-block-time",

  /* The chain: JSON-RPC. */
  "chain-data-timed-out",
  "chain-data-unreachable",
  "chain-data-credentials-rejected",
  "chain-data-rate-limited",
  "chain-data-unreadable",
  "chain-data-malformed",

  /* The pool itself. */
  "pool-not-found",
  "pool-contract-not-found",
  "pool-configuration-inconsistent",
  "pool-history-insufficient",

  /* The deterministic calculations. */
  "volatility-invalid-input",
  "volatility-insufficient-history",
  "volatility-unverifiable",
  "band-invalid-input",
  "band-no-current-price",
  "band-unverifiable",
  "range-invalid-input",
  "range-price-unrepresentable",
  "range-tick-disagreement",
  "range-too-narrow",
  "range-unverifiable",
  "divergence-unverifiable",
  "activity-unverifiable",
  "out-of-sample-insufficient-history",
  "out-of-sample-unverifiable",

  /* The written explanation. */
  "explanation-key-rejected",
  "explanation-model-not-permitted",
  "explanation-model-unknown",
  "explanation-rate-limited",
  "explanation-unreachable",
  "explanation-request-refused",
  "explanation-declined",
  "explanation-truncated",
  "explanation-malformed",
]);

export type DataFailureNotice = z.infer<typeof DataFailureNoticeSchema>;

/**
 * Something a reader should know about figures that are still shown.
 *
 * Every one of these accompanies real data. They are not errors and they are not
 * apologies: they say which part of a number rests on something incomplete, so a
 * reader can judge it. The most common by far is the first, which fires on every
 * successful analysis this application has ever produced.
 */
export const DataWarningNoticeSchema = z.enum([
  "block-time-unreported",
  "history-window-incomplete",
  "volatility-window-incomplete",
  "band-window-incomplete",
  "band-price-block-time-unreported",
  "band-volatility-block-time-unreported",
  "range-lower-edge-truncated",
  "range-upper-edge-truncated",
  "range-tick-unverified",
  "range-excludes-current-price",
]);

export type DataWarningNotice = z.infer<typeof DataWarningNoticeSchema>;
