import {
  type DataResult,
  type RangeInterpretation,
  RangeInterpretationSchema,
} from "../../schemas";

/*
 * Turns one model response into a verified interpretation, or into a reason it
 * is not usable.
 *
 * Pure: it takes what came back as plain values and returns a `DataResult`. No
 * client, no network, no SDK — which is what makes every failure path below
 * testable with a string.
 *
 * The schema is the authority here exactly as it is everywhere else in this
 * project. The API is asked to produce the right *shape*, but the rules that
 * matter — no figures, four sections, nothing extra — are checked on this side,
 * because a constraint the server does not enforce is not a constraint.
 */

const REFUSED =
  "The model declined to explain this pool's figures, so no explanation is shown.";
const TRUNCATED =
  "The explanation was cut off before it was complete, so it is not shown.";
const MALFORMED =
  "The explanation came back in a form this application cannot verify, so it is not shown.";

const unavailable = (message: string): DataResult<RangeInterpretation> => ({
  status: "unavailable",
  reason: "invalid-response",
  message,
});

export type RawInterpretationResponse = {
  /** Why the model stopped. `refusal` and `max_tokens` both mean no usable answer. */
  readonly stopReason: string | null;
  /** The model's text, or `null` when the response carried none. */
  readonly text: string | null;
};

export const normalizeRangeInterpretation = (
  response: RawInterpretationResponse,
): DataResult<RangeInterpretation> => {
  /*
   * Checked before the text, because a refusal still carries text — an
   * explanation of the refusal — and parsing that as an interpretation would
   * turn a decline into a malformed-response report.
   */
  if (response.stopReason === "refusal") return unavailable(REFUSED);

  /*
   * A response cut at the token ceiling is unparseable JSON, which would surface
   * as "malformed" and send someone looking for a bug in the model's output
   * rather than at the ceiling.
   */
  if (response.stopReason === "max_tokens") return unavailable(TRUNCATED);

  /*
   * Narrowing, not validation: an empty or whitespace-only body would fail the
   * parse below anyway, so there is no separate check for it.
   */
  if (response.text === null) return unavailable(MALFORMED);

  let payload: unknown;
  try {
    payload = JSON.parse(response.text);
  } catch {
    // The error carries the model's own text; reporting it would put
    // unvalidated model output in front of a reader.
    return unavailable(MALFORMED);
  }

  const interpretation = RangeInterpretationSchema.safeParse(payload);
  if (!interpretation.success) return unavailable(MALFORMED);

  return { status: "success", data: interpretation.data };
};
