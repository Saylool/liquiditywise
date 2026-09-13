import "server-only";

import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import type { DataResult, RangeInterpretation } from "../../schemas";
import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import type { Locale } from "../i18n/locales";
import { logUnavailable } from "../observability/serverDiagnostics";
import { interpretRange } from "./interpretRange";

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

export type RangeInterpretationRequest = {
  readonly analysis: PoolRangeAnalysis;
  readonly warnings: readonly string[];
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
): Promise<DataResult<RangeInterpretation>> => {
  const apiKey = process.env.OPENAI_API_KEY;

  return logUnavailable(
    LABEL,
    await interpretRange({
      analysis: request.analysis,
      warnings: request.warnings,
      locale: request.locale,
      apiKey,
      /*
       * The single point where this application's narrowed request meets the
       * SDK's own parameter type. The cast lives here, at the boundary, rather
       * than loosening the type every module above it works with.
       */
      createResponse: (params) =>
        new OpenAI({ apiKey }).responses.create(
          params as unknown as ResponseCreateParamsNonStreaming,
        ),
    }),
  );
};
