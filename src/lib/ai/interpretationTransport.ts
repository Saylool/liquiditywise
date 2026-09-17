import { zodTextFormat } from "openai/helpers/zod";

import {
  type DataFailureNotice,
  type DataFailureReason,
  RangeInterpretationWireSchema,
} from "../../schemas";
import type { RangeInterpretationPrompt } from "./prompts/rangeInterpretation";
import {
  INTERPRETATION_MAX_TOKENS,
  INTERPRETATION_REASONING_EFFORT,
  type InterpretationModel,
} from "./interpretationModel";
import { newlyFinishedSections, type SectionKey } from "./interpretationSections";

/*
 * The one call to the model, and the mapping from everything that can go wrong
 * with it onto this application's own failure categories.
 *
 * The client is injected rather than constructed here, so every branch below is
 * reachable from a test without a key, a network or a bill. The server-only
 * wrapper supplies the real one.
 *
 * This is the only module in the project that knows which provider writes the
 * explanations. The contract, the prompt, the check on the way back and the
 * composition above them are all provider-neutral, so changing supplier is a
 * change to this file and the dependency it imports.
 *
 * It translates the provider's own vocabulary — an incomplete response, a
 * refusal content block — into the two words the verifier downstream
 * understands. That keeps the verifier, which is where the rules actually live,
 * from having to learn a provider's shapes.
 */

const NOT_CONFIGURED = "explanation-not-configured";
const REJECTED_KEY = "explanation-key-rejected";
const NOT_PERMITTED = "explanation-model-not-permitted";
const UNKNOWN_MODEL = "explanation-model-unknown";
const RATE_LIMITED = "explanation-rate-limited";
const UNREACHABLE = "explanation-unreachable";
const UNUSABLE_REQUEST = "explanation-request-refused";

/** A content block inside one output item. */
type OutputContent = { readonly type: string };

/** One item of the response's output list. */
type OutputItem = { readonly type: string; readonly content?: readonly OutputContent[] };

/**
 * The part of a response this module reads. Every field is optional, so a real
 * SDK response satisfies it and a test can build one in a line.
 */
export type InterpretationResponse = {
  readonly model?: string | null;
  readonly output_text?: string | null;
  readonly incomplete_details?: { readonly reason?: string | null } | null;
  readonly output?: readonly OutputItem[];
};

/** The request this module sends. Narrower than the SDK's own parameter type. */
export type InterpretationRequestParams = {
  readonly model: string;
  readonly max_output_tokens: number;
  /** How hard to think first, which on this task was most of the wait. */
  readonly reasoning: { readonly effort: string };
  readonly input: readonly { readonly role: "system" | "user"; readonly content: string }[];
  readonly text: { readonly format: unknown };
};

/**
 * The subset of the SDK this module uses — one call, narrowed so a test can
 * supply a plain function rather than a whole client.
 */
export type ResponseCreator = (
  params: InterpretationRequestParams,
) => Promise<InterpretationResponse>;

export type InterpretationTransportResult =
  | {
      readonly ok: true;
      readonly stopReason: string;
      readonly text: string | null;
      /**
       * The model the provider says answered, which is not always the one that
       * was asked for — an alias can resolve to a dated build. Reported rather
       * than assumed, so the page credits what actually ran.
       */
      readonly model: string | null;
    }
  | { readonly ok: false; readonly reason: DataFailureReason; readonly notice: DataFailureNotice };

const failure = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): InterpretationTransportResult => ({ ok: false, reason, notice });

/**
 * An HTTP status, when the thrown value carries one.
 *
 * Read structurally rather than through `instanceof` so the mapping below can be
 * exercised with a plain object. The SDK's error classes all expose `status`.
 */
const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;

  const { status } = error as { status: unknown };
  return typeof status === "number" ? status : undefined;
};

/**
 * Maps a thrown value onto a failure category.
 *
 * A throw without a status never reached the service — no connection, or the
 * request ran past the budget in `INTERPRETATION_TIMEOUT_MS`. Both are reported
 * as unreachable: the SDK distinguishes them by class, but the distinction
 * changes nothing a reader or an operator would do differently, and either way
 * the page says the explanation is missing rather than guessing at one.
 */
const classifyThrown = (error: unknown): InterpretationTransportResult => {
  const status = statusOf(error);
  if (status === undefined) return failure("network-error", UNREACHABLE);

  /*
   * Split rather than collapsed into one "credentials" message, because the
   * three mean different things to whoever has to fix them: a key that is
   * wrong, a key that is right but not allowed this model, and a model name the
   * key cannot see. The status alone distinguishes them, so none of the
   * provider's own text has to be repeated to say which.
   */
  if (status === 401) return failure("configuration-error", REJECTED_KEY);
  if (status === 403) return failure("configuration-error", NOT_PERMITTED);
  if (status === 404) return failure("configuration-error", UNKNOWN_MODEL);
  if (status === 429) return failure("rate-limited", RATE_LIMITED);
  if (status >= 500) return failure("network-error", UNREACHABLE);

  return failure("invalid-response", UNUSABLE_REQUEST);
};

/**
 * Translates however this provider says it stopped into the two cases the
 * verifier downstream treats differently.
 *
 * A refusal can arrive two ways — as a refusal block among the output, or as an
 * incomplete response the safety filter ended — and both mean the same thing to
 * a reader.
 */
const stopReasonOf = (response: InterpretationResponse): string => {
  const refused = (response.output ?? []).some(
    (item) =>
      item.type === "refusal" ||
      (item.content ?? []).some((content) => content.type === "refusal"),
  );
  if (refused) return "refusal";

  const reason = response.incomplete_details?.reason;
  if (reason === "max_output_tokens") return "max_tokens";
  if (reason === "content_filter") return "refusal";

  return "end_turn";
};

export type InterpretationRequest = {
  readonly prompt: RangeInterpretationPrompt;
  readonly apiKey: string | undefined;
  /** Resolved by the caller, so this module never reads the environment. */
  readonly model: InterpretationModel;
  readonly createResponse: ResponseCreator;
};

/**
 * One event of a streamed answer, narrowed to what this module reads: the text
 * deltas that build the JSON object, and the finished response that arrives
 * with the last of them.
 */
export type InterpretationStreamEvent = {
  readonly type?: string;
  readonly delta?: string;
  readonly response?: InterpretationResponse;
};

/** The event a provider sends for each piece of the answer's text. */
const TEXT_DELTA = "response.output_text.delta";

/** The streaming half of {@link ResponseCreator}, injected for the same reason. */
export type StreamCreator = (
  params: InterpretationRequestParams & { readonly stream: true },
) => Promise<AsyncIterable<InterpretationStreamEvent>>;

export type StreamedInterpretationRequest = {
  readonly prompt: RangeInterpretationPrompt;
  readonly apiKey: string | undefined;
  readonly model: InterpretationModel;
  readonly createStream: StreamCreator;
  /**
   * Called with each section the moment it has finished arriving and passed
   * its own rule — the same rule the whole answer is held to when it lands.
   */
  readonly onSection: (key: SectionKey, prose: string) => void;
};

/**
 * Asks for the explanation as a stream, and hands each finished paragraph on
 * as it arrives.
 *
 * The answer that comes back at the end is the same shape the non-streaming
 * call returns, and it goes through the same verification: the early release
 * is an addition to that path, never a replacement for it. A reader is shown a
 * paragraph early only when it has already passed the check it would face
 * later anyway.
 *
 * A stream that ends without the provider saying it finished is treated as a
 * connection that dropped, because that is what it is — the accumulated text
 * would be a truncated object, and publishing half a sentence is the one thing
 * this path must not do.
 */
export const streamInterpretation = async (
  request: StreamedInterpretationRequest,
): Promise<InterpretationTransportResult> => {
  if (request.apiKey === undefined || request.apiKey.trim().length === 0) {
    return failure("configuration-error", NOT_CONFIGURED);
  }

  try {
    const stream = await request.createStream({
      model: request.model,
      max_output_tokens: INTERPRETATION_MAX_TOKENS,
      reasoning: { effort: INTERPRETATION_REASONING_EFFORT },
      input: [
        { role: "system", content: request.prompt.system },
        { role: "user", content: request.prompt.user },
      ],
      text: { format: zodTextFormat(RangeInterpretationWireSchema, "range_interpretation") },
      stream: true,
    });

    let text = "";
    let finished: InterpretationResponse | null = null;
    const delivered = new Set<string>();

    for await (const event of stream) {
      if (event.type === TEXT_DELTA && typeof event.delta === "string") {
        text += event.delta;
        for (const section of newlyFinishedSections(text, delivered)) {
          delivered.add(section.key);
          request.onSection(section.key, section.prose);
        }
      }
      if (event.response !== undefined) finished = event.response;
    }

    if (finished === null) return failure("network-error", UNREACHABLE);

    const answer = finished.output_text ?? (text.length === 0 ? null : text);

    return {
      ok: true,
      stopReason: stopReasonOf(finished),
      text: answer === null || answer.length === 0 ? null : answer,
      model: finished.model ?? null,
    };
  } catch (error) {
    return classifyThrown(error);
  }
};

export const requestInterpretation = async (
  request: InterpretationRequest,
): Promise<InterpretationTransportResult> => {
  /*
   * Checked here rather than left to a 401, so a deployment that was never
   * configured is told so plainly and without spending a request to find out.
   */
  if (request.apiKey === undefined || request.apiKey.trim().length === 0) {
    return failure("configuration-error", NOT_CONFIGURED);
  }

  try {
    const response = await request.createResponse({
      model: request.model,
      max_output_tokens: INTERPRETATION_MAX_TOKENS,
      reasoning: { effort: INTERPRETATION_REASONING_EFFORT },
      input: [
        { role: "system", content: request.prompt.system },
        { role: "user", content: request.prompt.user },
      ],
      /*
       * Shape only. The rules live in `RangeInterpretationSchema` and are
       * applied to the answer, not requested of the provider.
       */
      text: { format: zodTextFormat(RangeInterpretationWireSchema, "range_interpretation") },
    });

    const text = response.output_text ?? null;

    return {
      ok: true,
      stopReason: stopReasonOf(response),
      text: text === null || text.length === 0 ? null : text,
      model: response.model ?? null,
    };
  } catch (error) {
    return classifyThrown(error);
  }
};
