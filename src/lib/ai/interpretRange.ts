import type { DataResult, RangeInterpretation } from "../../schemas";
import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import type { Locale } from "../i18n/locales";
import { normalizeRangeInterpretation } from "./rangeInterpretationAdapter";
import { buildRangeInterpretationPrompt } from "./prompts/rangeInterpretation";
import { type ResponseCreator, requestInterpretation } from "./interpretationTransport";

/*
 * Prompt, call, verify — the whole path from a finished analysis to a checked
 * explanation, with the client still injected so it runs without credentials.
 *
 * The analysis arrives already computed and already verified. Nothing here adds
 * to it, and nothing the model returns is allowed to change it: an explanation
 * that fails its contract is dropped, and the figures stand on their own.
 */

export type InterpretRangeInput = {
  readonly analysis: PoolRangeAnalysis;
  /** The caveats the pipeline attached, so the explanation can account for them. */
  readonly warnings: readonly string[];
  readonly locale: Locale;
  readonly apiKey: string | undefined;
  readonly createResponse: ResponseCreator;
};

export const interpretRange = async (
  input: InterpretRangeInput,
): Promise<DataResult<RangeInterpretation>> => {
  const prompt = buildRangeInterpretationPrompt({
    analysis: input.analysis,
    locale: input.locale,
    warnings: input.warnings,
  });

  const response = await requestInterpretation({
    prompt,
    apiKey: input.apiKey,
    createResponse: input.createResponse,
  });

  if (!response.ok) {
    return { status: "unavailable", reason: response.reason, message: response.message };
  }

  return normalizeRangeInterpretation({
    stopReason: response.stopReason,
    text: response.text,
  });
};
