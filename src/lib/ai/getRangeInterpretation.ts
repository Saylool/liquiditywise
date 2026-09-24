import type { DataWarningNotice } from "../../schemas";
import "server-only";

import OpenAI from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
} from "openai/resources/responses/responses";


import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import type { Locale } from "../i18n/locales";
import { logDetail, logUnavailable, logUsage } from "../observability/serverDiagnostics";
import { cappedLine, spendLine } from "../usage/usageLines";
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
import { interpretRange, streamRange, type WrittenInterpretation } from "./interpretRange";
import type { InterpretationStreamEvent } from "./interpretationTransport";
import type { SectionKey } from "./interpretationSections";
import {
  createSectionGates,
  type SectionOutcome,
  settledSectionGates,
} from "./sectionGates";
import type { InterpretationOutcome } from "./rangeInterpretationAdapter";
import { createExplanationBudget } from "./explanationBudget";
import { observeUsage, usageOf, type TokenUsage } from "./usageObserver";

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
/** The server's hourly ceiling on new explanations; see explanationBudget.ts. */
const budget = createExplanationBudget();

/** What a reader is shown in the explanation's place once the ceiling is reached. */
const CAPPED: InterpretationOutcome<WrittenInterpretation> = {
  status: "unavailable",
  reason: "rate-limited",
  notice: "explanation-hourly-cap",
};

const poolOf = (analysis: PoolRangeAnalysis): string =>
  `${analysis.history.pool.protocolVersion}:${analysis.history.pool.id.toLowerCase()}`;

/**
 * Records what one explanation cost, for the weekly report. Written whether
 * or not the answer then passed its checks: the tokens were spent either way.
 */
const recordSpend = (analysis: PoolRangeAnalysis, model: string, usage: TokenUsage): void => {
  logUsage(
    spendLine({
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      pool: poolOf(analysis),
      pair: `${analysis.pool.token0.symbol}/${analysis.pool.token1.symbol}`,
    }),
  );
};

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

  // Past the ceiling nothing is asked of the model; a cached answer above was still free.
  if (!budget.take()) {
    logUsage(cappedLine(poolOf(request.analysis)));
    return CAPPED;
  }

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
      })
        .responses.create(params as unknown as ResponseCreateParamsNonStreaming)
        .then((response) => {
          const usage = usageOf({ response });
          if (usage !== null) recordSpend(request.analysis, model, usage);
          return response;
        }),
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

/**
 * An explanation being written, as four things that settle one at a time.
 *
 * The page renders a boundary per section and one more for the credit under
 * them, so the first paragraph reaches a reader while the last is still being
 * written. Measured against the live model, the first lands at about eight
 * seconds and the whole answer at about thirteen; the panel used to show
 * nothing at all until the thirteenth.
 */
export type StreamedRangeInterpretation = {
  readonly sections: Readonly<Record<SectionKey, Promise<SectionOutcome>>>;
  /** The answer as a whole, verified, cached and logged — the same one as before. */
  readonly whole: Promise<InterpretationOutcome<WrittenInterpretation>>;
};

/**
 * Starts writing the explanation and hands back its parts.
 *
 * Deliberately not `async`: the caller needs the promises now, not when the
 * answer is finished. A cached answer settles all of them immediately, which is
 * why a second reader of the same pool sees the whole thing at once.
 */
export const streamRangeInterpretation = (
  request: RangeInterpretationRequest,
): StreamedRangeInterpretation => {
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
  if (cached !== undefined) {
    return {
      sections: settledSectionGates(cached.interpretation),
      whole: Promise.resolve({ status: "success", data: cached }),
    };
  }

  if (!budget.take()) {
    logUsage(cappedLine(poolOf(request.analysis)));
    const closed = createSectionGates();
    closed.closeRemaining();
    return { sections: closed.sections, whole: Promise.resolve(CAPPED) };
  }

  const gates = createSectionGates();
  const whole = streamRange({
    analysis: request.analysis,
    warnings: request.warnings,
    locale: request.locale,
    apiKey,
    model,
    onSection: gates.deliver,
    onDiagnostic: (detail) => {
      logDetail(LABEL, `answer rejected — ${detail}`);
    },
    /*
     * The streaming twin of the cast below it, at the same boundary and for the
     * same reason: this application's narrowed request meeting the SDK's own
     * parameter type, once, where it can be read.
     */
    createStream: async (params) =>
      observeUsage(
        (await new OpenAI({
          apiKey,
          timeout: INTERPRETATION_TIMEOUT_MS,
          maxRetries: INTERPRETATION_MAX_RETRIES,
        }).responses.create(
          params as unknown as ResponseCreateParamsStreaming,
        )) as unknown as AsyncIterable<InterpretationStreamEvent>,
        (usage) => recordSpend(request.analysis, model, usage),
      ),
  })
    .then((outcome) => {
      if (outcome.status === "success") cache.set(key, outcome.data);
      logUnavailable(LABEL, outcome);
      return outcome;
    })
    /*
     * Nothing above throws today, and a page whose sections never settle would
     * spin for ever if something ever did.
     */
    .catch((): InterpretationOutcome<WrittenInterpretation> => ({
      status: "unavailable",
      reason: "network-error",
      notice: "explanation-unreachable",
    }))
    .finally(() => {
      gates.closeRemaining();
    });

  return { sections: gates.sections, whole };
};
