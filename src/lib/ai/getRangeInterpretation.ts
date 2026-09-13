import "server-only";

import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";


import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import type { Locale } from "../i18n/locales";
import { logDetail, logUnavailable } from "../observability/serverDiagnostics";
import { type InterpretationModel, resolveInterpretationModel } from "./interpretationModel";
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
): Promise<InterpretationOutcome<WrittenInterpretation>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = interpretationModelInUse();

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
      new OpenAI({ apiKey }).responses.create(
        params as unknown as ResponseCreateParamsNonStreaming,
      ),
  });

  /*
   * Logged for its effect, and the narrower outcome returned unchanged. The
   * logger speaks `DataResult`, which an interpretation outcome satisfies but
   * is wider than — routing the value through it would give every caller back a
   * `partial` state an explanation can never be in.
   */
  logUnavailable(LABEL, outcome);

  return outcome;
};
