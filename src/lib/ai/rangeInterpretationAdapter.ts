import type { DataFailureNotice } from "../../schemas";
import {
  type DataFailureReason,
  INTERPRETATION_METHOD,
  type RangeInterpretation,
  RangeInterpretationSectionsSchema,
} from "../../schemas";

/*
 * Turns one model response into a verified interpretation, or into a reason it
 * is not usable.
 *
 * Pure: it takes what came back as plain values and returns a `DataResult`. No
 * client, no network, no SDK — which is what makes every failure path below
 * testable with a string.
 *
/**
 * Either a verified explanation or a reason there is none.
 *
 * Narrower than `DataResult` on purpose: that type has a `partial` state for a
 * source that supplied some fields and not others, and an explanation has no
 * such middle. Half of one is not one, and a shape that could express it would
 * invite somebody to render it.
 */
export type InterpretationOutcome<T> =
  | { readonly status: "success"; readonly data: T }
  | {
      readonly status: "unavailable";
      readonly reason: DataFailureReason;
      readonly notice: DataFailureNotice;
    };

/*
 * The schema is the authority here exactly as it is everywhere else in this
 * project. The API is asked to produce the right *shape*, but the rules that
 * matter — no figures, four sections, nothing extra — are checked on this side,
 * because a constraint the server does not enforce is not a constraint.
 */

const REFUSED = "explanation-declined";
const TRUNCATED = "explanation-truncated";
const MALFORMED = "explanation-malformed";

const unavailable = (
  notice: DataFailureNotice,
): InterpretationOutcome<RangeInterpretation> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/**
 * Told which rule an answer broke, so an operator is not left guessing.
 *
 * Given field names and rule codes only. The reader's message is the same
 * sentence whichever rule failed — that is deliberate, since none of the
 * distinctions matter to them — but "could not be verified" is not a useful
 * thing to find in a log.
 */
export type InterpretationDiagnostic = (detail: string) => void;

/** Names what failed without repeating a word the model wrote. */
const describeIssues = (issues: readonly { path: PropertyKey[]; code: string }[]): string =>
  issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`)
    .join(", ");

export type RawInterpretationResponse = {
  /** Why the model stopped. `refusal` and `max_tokens` both mean no usable answer. */
  readonly stopReason: string | null;
  /** The model's text, or `null` when the response carried none. */
  readonly text: string | null;
};

export const normalizeRangeInterpretation = (
  response: RawInterpretationResponse,
  onDiagnostic?: InterpretationDiagnostic,
): InterpretationOutcome<RangeInterpretation> => {
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
    onDiagnostic?.("body was not JSON");
    return unavailable(MALFORMED);
  }

  const sections = RangeInterpretationSectionsSchema.safeParse(payload);
  if (!sections.success) {
    onDiagnostic?.(describeIssues(sections.error.issues));
    return unavailable(MALFORMED);
  }

  /*
   * The label is attached here rather than asked of the model. It states which
   * kind of analysis the prose explains, which is this application's claim about
   * its own pipeline — not something a model could know.
   */
  return { status: "success", data: { ...sections.data, method: INTERPRETATION_METHOD } };
};
