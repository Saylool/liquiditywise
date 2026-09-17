import type { DataWarningNotice } from "../../schemas";
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
import type { SectionKey } from "./interpretationSections";
import {
  type InterpretationTransportResult,
  type ResponseCreator,
  requestInterpretation,
  type StreamCreator,
  streamInterpretation,
} from "./interpretationTransport";

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
  readonly warnings: readonly DataWarningNotice[];
  readonly locale: Locale;
  readonly apiKey: string | undefined;
  readonly model: InterpretationModel;
  readonly createResponse: ResponseCreator;
  /** Told which rule an unusable answer broke. Optional; nothing depends on it. */
  readonly onDiagnostic?: InterpretationDiagnostic | undefined;
};

/**
 * The half both paths share: whatever came back is checked, and only a whole
 * answer that passes becomes an explanation.
 *
 * Streaming changes when a paragraph reaches the page, never whether it was
 * checked. The early release hands on sections that have each passed the same
 * rule; this is where the answer as a whole is held to it.
 */
const verifyAnswer = (
  response: InterpretationTransportResult,
  input: Pick<InterpretRangeInput, "model" | "onDiagnostic">,
): InterpretationOutcome<WrittenInterpretation> => {
  if (!response.ok) {
    return { status: "unavailable", reason: response.reason, notice: response.notice };
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

export const interpretRange = async (
  input: InterpretRangeInput,
): Promise<InterpretationOutcome<WrittenInterpretation>> => {
  const response = await requestInterpretation({
    prompt: buildRangeInterpretationPrompt({
      analysis: input.analysis,
      locale: input.locale,
      warnings: input.warnings,
    }),
    apiKey: input.apiKey,
    model: input.model,
    createResponse: input.createResponse,
  });

  return verifyAnswer(response, input);
};

export type StreamRangeInput = Omit<InterpretRangeInput, "createResponse"> & {
  readonly createStream: StreamCreator;
  /** Handed each paragraph as it finishes, already checked against its own rule. */
  readonly onSection: (key: SectionKey, prose: string) => void;
};

/**
 * The same path, asked for as a stream: identical prompt, identical check on
 * the way back, and each finished paragraph handed on while the rest is still
 * being written.
 */
export const streamRange = async (
  input: StreamRangeInput,
): Promise<InterpretationOutcome<WrittenInterpretation>> => {
  const response = await streamInterpretation({
    prompt: buildRangeInterpretationPrompt({
      analysis: input.analysis,
      locale: input.locale,
      warnings: input.warnings,
    }),
    apiKey: input.apiKey,
    model: input.model,
    createStream: input.createStream,
    onSection: input.onSection,
  });

  return verifyAnswer(response, input);
};
