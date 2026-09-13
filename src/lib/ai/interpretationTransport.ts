import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { type DataFailureReason, RangeInterpretationSchema } from "../../schemas";
import type { RangeInterpretationPrompt } from "./prompts/rangeInterpretation";
import { INTERPRETATION_MAX_TOKENS, INTERPRETATION_MODEL } from "./interpretationModel";

/*
 * The one call to the model, and the mapping from everything that can go wrong
 * with it onto this application's own failure categories.
 *
 * The client is injected rather than constructed here, so every branch below is
 * reachable from a test without a key, a network or a bill. The server-only
 * wrapper supplies the real one.
 *
 * `output_config.format` asks the API for the right shape. It is worth knowing
 * what that does and does not buy: the generated JSON Schema carries
 * `additionalProperties: false` and `required` as real constraints, but the
 * length bounds and the literal method label survive only as *descriptions* the
 * model reads. They are hints there and rules on our side — which is why the
 * response is still parsed through the schema rather than trusted.
 */

const NOT_CONFIGURED =
  "This application is not configured to write explanations, so none is shown.";
const REJECTED_CREDENTIALS =
  "The explanation service rejected the configured credentials, so no explanation is shown.";
const RATE_LIMITED =
  "The explanation service is rate limited right now, so no explanation is shown.";
const UNREACHABLE =
  "The explanation service could not be reached, so no explanation is shown.";
const UNUSABLE_REQUEST =
  "The explanation service refused this request, so no explanation is shown.";

/** The part of a response this module reads. The SDK's `Message` satisfies it. */
export type InterpretationMessage = {
  readonly stop_reason: string | null;
  readonly content: readonly { readonly type: string; readonly text?: string }[];
};

/**
 * The subset of the SDK this module uses — one call, narrowed so a test can
 * supply a plain function rather than a whole client.
 */
export type MessageCreator = (
  params: MessageCreateParamsNonStreaming,
) => Promise<InterpretationMessage>;

export type InterpretationTransportResult =
  | { readonly ok: true; readonly stopReason: string | null; readonly text: string | null }
  | { readonly ok: false; readonly reason: DataFailureReason; readonly message: string };

const failure = (
  reason: DataFailureReason,
  message: string,
): InterpretationTransportResult => ({ ok: false, reason, message });

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
 * request timed out waiting. Both are reported as unreachable: the SDK
 * distinguishes them by class, but the distinction changes nothing a reader or
 * an operator would do differently, and the server log records the error's name
 * separately.
 */
const classifyThrown = (error: unknown): InterpretationTransportResult => {
  const status = statusOf(error);
  if (status === undefined) return failure("network-error", UNREACHABLE);

  if (status === 401 || status === 403) {
    return failure("configuration-error", REJECTED_CREDENTIALS);
  }
  if (status === 429) return failure("rate-limited", RATE_LIMITED);
  if (status >= 500) return failure("network-error", UNREACHABLE);

  return failure("invalid-response", UNUSABLE_REQUEST);
};

/** The text the model wrote, joined across blocks, or `null` when it wrote none. */
const textOf = (message: InterpretationMessage): string | null => {
  const parts = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "");

  return parts.length === 0 ? null : parts.join("");
};

export type InterpretationRequest = {
  readonly prompt: RangeInterpretationPrompt;
  readonly apiKey: string | undefined;
  readonly createMessage: MessageCreator;
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
    const message = await request.createMessage({
      model: INTERPRETATION_MODEL,
      max_tokens: INTERPRETATION_MAX_TOKENS,
      system: request.prompt.system,
      messages: [{ role: "user", content: request.prompt.user }],
      output_config: { format: zodOutputFormat(RangeInterpretationSchema) },
    });

    return { ok: true, stopReason: message.stop_reason, text: textOf(message) };
  } catch (error) {
    return classifyThrown(error);
  }
};
