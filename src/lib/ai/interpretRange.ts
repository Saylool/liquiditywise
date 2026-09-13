import type { RangeInterpretation } from "../../schemas";
import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import type { Locale } from "../i18n/locales";
import {
  type InterpretationDiagnostic,
  type InterpretationOutcome,
  normalizeRangeInterpretation,
} from "./rangeInterpretationAdapter";
import { buildRangeInterpretationPrompt } from "./prompts/rangeInterpretation";
import type { InterpretationModel } from "./interpretationModel";
import { type ResponseCreator, requestInterpretation } from "./interpretationTransport";

/*
 * Prompt, call, verify — the whole path from a finished analysis to a checked
 * explanation, with the client still injected so it runs without credentials.
 *
 * The analysis arrives already computed and already verified. Nothing here adds
 * to it, and nothing the model returns is allowed to change it: an explanation
 * that fails its contract is dropped, and the figures stand on their own.
 */

/**
 * A verified explanation and the model that actually wrote it.
 *
 * The model is reported by the provider rather than taken from the request: an
 * alias can resolve to a dated build, and a page that credited the name it
 * asked for would be stating something it never confirmed. When the provider
 * names nothing, the requested model is used and is the closest thing to an
 * answer available.
 */
export type WrittenInterpretation = {
  readonly interpretation: RangeInterpretation;
  readonly model: string;
};

export type InterpretRangeInput = {
  readonly analysis: PoolRangeAnalysis;
  /** The caveats the pipeline attached, so the explanation can account for them. */
  readonly warnings: readonly string[];
  readonly locale: Locale;
  readonly apiKey: string | undefined;
  readonly model: InterpretationModel;
  readonly createResponse: ResponseCreator;
  /** Told which rule an unusable answer broke. Optional; nothing depends on it. */
  readonly onDiagnostic?: InterpretationDiagnostic | undefined;
};

export const interpretRange = async (
  input: InterpretRangeInput,
): Promise<InterpretationOutcome<WrittenInterpretation>> => {
  const prompt = buildRangeInterpretationPrompt({
    analysis: input.analysis,
    locale: input.locale,
    warnings: input.warnings,
  });

  const response = await requestInterpretation({
    prompt,
    apiKey: input.apiKey,
    model: input.model,
    createResponse: input.createResponse,
  });

  if (!response.ok) {
    return { status: "unavailable", reason: response.reason, message: response.message };
  }

  const verified = normalizeRangeInterpretation(
    { stopReason: response.stopReason, text: response.text },
    input.onDiagnostic,
  );

  if (verified.status === "unavailable") return verified;

  return {
    status: "success",
    data: { interpretation: verified.data, model: response.model ?? input.model },
  };
};
