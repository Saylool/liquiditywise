import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { DataResult, RangeInterpretation } from "../../schemas";
import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import type { Locale } from "../i18n/locales";
import { logUnavailable } from "../observability/serverDiagnostics";
import { interpretRange } from "./interpretRange";

/*
 * The server-only boundary for the explanation.
 *
 * `import "server-only"` makes importing this from a Client Component a build
 * error, which is what keeps `ANTHROPIC_API_KEY` out of a browser bundle. It is
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
  const apiKey = process.env.ANTHROPIC_API_KEY;

  return logUnavailable(
    LABEL,
    await interpretRange({
      analysis: request.analysis,
      warnings: request.warnings,
      locale: request.locale,
      apiKey,
      /*
       * Constructed inside the call so the key is read per request. The client
       * is only reached when a key exists — the transport checks that first, and
       * this function is never invoked without one having been supplied.
       */
      createMessage: (params) => new Anthropic({ apiKey }).messages.create(params),
    }),
  );
};
