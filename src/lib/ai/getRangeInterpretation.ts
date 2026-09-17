import type { DataWarningNotice } from "../../schemas";
import "server-only";

import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";


import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import type { Locale } from "../i18n/locales";
import { logDetail, logUnavailable } from "../observability/serverDiagnostics";
import {
  createInterpretationCache,
  interpretationCacheKey,
} from "./interpretationCache";
import { BASE_INSTRUCTION } from "./prompts/base";
import {
  INTERPRETATION_MAX_RETRIES,
  INTERPRETATION_TIMEOUT_MS,
  type InterpretationModel,
  resolveInterpretationModel,
} from "./interpretationModel";
import { interpretRange, type WrittenInterpretation } from "./interpretRange";
import type { InterpretationOutcome } from "./rangeInterpretationAdapter";

/*
 * The server-only boundary for the explanation.
 *
 * `import "server-only"` makes importing this from a Client Component a build
 * error, which is what keeps `OPENAI_API_KEY` out of a browser bundle. It is
 * deliberately absent from every barrel file, like the other credential paths.
 *
 * It holds no logic — only the two impure things the pure layer cannot own:
 * reading the environment and constructing the client.
 */

/** Identifies this reader in server-side diagnostics. */
const LABEL = "interpretation";

/**
 * The model this deployment is actually using.
 *
 * Exported so the page can name it under the prose it wrote, and so the
 * environment is read through one resolver rather than two — a page that
 * credited a different model than the one called would be worse than crediting
 * none at all.
 */
export const interpretationModelInUse = (): InterpretationModel =>
  resolveInterpretationModel(process.env.OPENAI_MODEL);

/**
 * A bound on how old reused prose may be.
 *
 * Not a correctness requirement — the key already covers everything the
 * sentences could depend on — but an upper limit on how long any one answer
 * stays in circulation. An hour is long enough that a popular pool costs one
 * call rather than one per visitor, and short enough that nothing lingers.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Ceiling on entries. A few hundred explanations is a few hundred kilobytes. */
const CACHE_MAX_ENTRIES = 500;

/*
 * Module-level, so it lives as long as the process. Like every other in-memory
 * store here it is per-instance: a platform running several copies keeps
 * several caches and calls the model once per copy. That costs a little more
 * than a shared store would and is wrong in no way — an entry is either valid
 * or absent, never stale in one place and fresh in another.
 */
const cache = createInterpretationCache<WrittenInterpretation>({
  ttlMs: CACHE_TTL_MS,
  maxEntries: CACHE_MAX_ENTRIES,
  now: () => Date.now(),
});

export type RangeInterpretationRequest = {
  readonly analysis: PoolRangeAnalysis;
  readonly warnings: readonly DataWarningNotice[];
  readonly locale: Locale;
};

/**
 * Writes the plain-language explanation for one finished analysis.
 *
 * The environment is read per call rather than captured at module load, so a
 * configuration change takes effect without a restart and no stale credential
 * is held in a closure.
 */
export const getRangeInterpretation = async (
  request: RangeInterpretationRequest,
): Promise<InterpretationOutcome<WrittenInterpretation>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = interpretationModelInUse();

  const key = interpretationCacheKey({
    analysis: request.analysis,
    warnings: request.warnings,
    locale: request.locale,
    model,
    instruction: BASE_INSTRUCTION,
  });

  const cached = cache.get(key);
  if (cached !== undefined) return { status: "success", data: cached };

  const outcome = await interpretRange({
    analysis: request.analysis,
    warnings: request.warnings,
    locale: request.locale,
    apiKey,
    model,
    onDiagnostic: (detail) => {
      logDetail(LABEL, `answer rejected — ${detail}`);
    },
    /*
     * The single point where this application's narrowed request meets the
     * SDK's own parameter type. The cast lives here, at the boundary, rather
     * than loosening the type every module above it works with.
     */
    createResponse: (params) =>
      /*
       * Both bounds are set here rather than left to the SDK, whose defaults
       * are ten minutes and two retries — three attempts of ten minutes each
       * in front of a page section. See the constants for what they are sized
       * against.
       */
      new OpenAI({
        apiKey,
        timeout: INTERPRETATION_TIMEOUT_MS,
        maxRetries: INTERPRETATION_MAX_RETRIES,
      }).responses.create(params as unknown as ResponseCreateParamsNonStreaming),
  });

  /*
   * Only a usable answer is kept. Caching a failure would pin whatever went
   * wrong in place for the next hour — a rate limit that has since cleared, or
   * a key that has since been fixed — and the failures are cheap to repeat
   * anyway: a missing key never reaches the network at all.
   */
  if (outcome.status === "success") cache.set(key, outcome.data);

  /*
   * Logged for its effect, and the narrower outcome returned unchanged. The
   * logger speaks `DataResult`, which an interpretation outcome satisfies but
   * is wider than — routing the value through it would give every caller back a
   * `partial` state an explanation can never be in.
   */
  logUnavailable(LABEL, outcome);

  return outcome;
};
