import { describe, expect, it } from "vitest";

import { DEFAULT_INTERPRETATION_MODEL, INTERPRETATION_MAX_TOKENS } from "./interpretationModel";
import {
  type InterpretationRequestParams,
  type InterpretationResponse,
  type ResponseCreator,
  requestInterpretation,
} from "./interpretationTransport";

const prompt = { system: "Standing rules.", user: "POOL\n- Pair: USDC / WETH" };

const answered = (response: InterpretationResponse = { output_text: "{}" }) => {
  const calls: InterpretationRequestParams[] = [];
  const createResponse: ResponseCreator = async (params) => {
    calls.push(params);
    return response;
  };
  return { calls, createResponse };
};

const threw = (error: unknown) => {
  let called = 0;
  const createResponse: ResponseCreator = async () => {
    called += 1;
    throw error;
  };
  return { calledCount: () => called, createResponse };
};

const send = (createResponse: ResponseCreator) =>
  requestInterpretation({
    prompt,
    apiKey: "sk-test",
    model: DEFAULT_INTERPRETATION_MODEL,
    createResponse,
  });

describe("requestInterpretation", () => {
  it("sends the model, the ceiling and both halves of the prompt", async () => {
    const { calls, createResponse } = answered();
    await send(createResponse);

    expect(calls).toHaveLength(1);
    const [params] = calls;
    expect(params?.model).toBe(DEFAULT_INTERPRETATION_MODEL);
    expect(params?.max_output_tokens).toBe(INTERPRETATION_MAX_TOKENS);
    expect(params?.input).toEqual([
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ]);
  });

  it("asks the provider for the right shape", async () => {
    const { calls, createResponse } = answered();
    await send(createResponse);

    expect(calls[0]?.text.format).toBeDefined();
  });

  /*
   * Only the shape. The rules — the length bounds, the fixed label, the refusal
   * of any figure — are applied to the answer rather than requested of the
   * provider, because providers differ in which keywords they accept and one
   * they reject fails the whole request.
   */
  it("sends no rule the provider might refuse", async () => {
    const { calls, createResponse } = answered();
    await send(createResponse);

    const wire = JSON.stringify(calls[0]?.text.format);
    expect(wire).toContain("whatThisRangeMeans");
    expect(wire).not.toContain("minLength");
    expect(wire).not.toContain("maxLength");
    expect(wire).toContain('"additionalProperties":false');
  });

  it("passes back what the model wrote", async () => {
    const { createResponse } = answered({ output_text: '{"ok":true}' });

    await expect(send(createResponse)).resolves.toEqual({
      ok: true,
      stopReason: "end_turn",
      text: '{"ok":true}',
      model: null,
    });
  });

  /*
   * Reported, not assumed. An alias can resolve to a dated build, and the page
   * credits whatever actually answered.
   */
  it("passes back which model the provider says answered", async () => {
    const { createResponse } = answered({
      model: "gpt-5.6-terra-2026-08-01",
      output_text: "{}",
    });

    expect(await send(createResponse)).toMatchObject({ model: "gpt-5.6-terra-2026-08-01" });
  });

  it.each([
    ["no text at all", {}],
    ["an empty string", { output_text: "" }],
    ["an explicit null", { output_text: null }],
  ])("reports %s as none, rather than as an empty answer", async (_label, response) => {
    const { createResponse } = answered(response);

    expect(await send(createResponse)).toMatchObject({ ok: true, text: null });
  });

  /*
   * A refusal arrives two ways and means the same thing to a reader, so both are
   * translated into the one word the verifier downstream acts on.
   */
  it("recognises a refusal among the output items", async () => {
    const { createResponse } = answered({
      output_text: "I can't help with that.",
      output: [{ type: "refusal" }],
    });

    expect(await send(createResponse)).toMatchObject({ ok: true, stopReason: "refusal" });
  });

  it("recognises a refusal nested inside a message", async () => {
    const { createResponse } = answered({
      output_text: "",
      output: [{ type: "message", content: [{ type: "refusal" }] }],
    });

    expect(await send(createResponse)).toMatchObject({ ok: true, stopReason: "refusal" });
  });

  it("treats a filtered response as a refusal too", async () => {
    const { createResponse } = answered({
      output_text: "",
      incomplete_details: { reason: "content_filter" },
    });

    expect(await send(createResponse)).toMatchObject({ ok: true, stopReason: "refusal" });
  });

  it("reports an answer stopped at the ceiling as cut off, not as a refusal", async () => {
    const { createResponse } = answered({
      output_text: '{"method":"verified',
      incomplete_details: { reason: "max_output_tokens" },
    });

    expect(await send(createResponse)).toMatchObject({ ok: true, stopReason: "max_tokens" });
  });

  it("calls an ordinary answer ordinary", async () => {
    const { createResponse } = answered({
      output_text: "{}",
      output: [{ type: "message", content: [{ type: "output_text" }] }],
      incomplete_details: null,
    });

    expect(await send(createResponse)).toMatchObject({ ok: true, stopReason: "end_turn" });
  });

  /*
   * Checked before the request, so a deployment that was never configured is
   * told so plainly instead of spending a call to discover it.
   */
  it.each([
    ["absent", undefined],
    ["blank", ""],
    ["only whitespace", "   "],
  ])("refuses to call the service when the key is %s", async (_label, apiKey) => {
    const { calledCount, createResponse } = threw(new Error("should not be reached"));

    /*
     * Called directly rather than through the helper: a default parameter cannot
     * tell an argument that was omitted from one passed as `undefined`, and
     * `undefined` is precisely the case under test.
     */
    const result = await requestInterpretation({
      prompt,
      apiKey,
      model: DEFAULT_INTERPRETATION_MODEL,
      createResponse,
    });

    expect(result).toMatchObject({ ok: false, reason: "configuration-error" });
    expect(calledCount()).toBe(0);
  });

  it.each([
    ["a rejected key", 401, "configuration-error"],
    ["a forbidden key", 403, "configuration-error"],
    ["a rate limit", 429, "rate-limited"],
    ["a server fault", 500, "network-error"],
    ["an overloaded service", 529, "network-error"],
    ["a request the service refused", 400, "invalid-response"],
    ["an unknown client error", 422, "invalid-response"],
  ])("maps %s onto its own category", async (_label, status, reason) => {
    const { createResponse } = threw(Object.assign(new Error("failed"), { status }));

    expect(await send(createResponse)).toMatchObject({ ok: false, reason });
  });

  it("treats a throw with no status as never having reached the service", async () => {
    const { createResponse } = threw(new Error("fetch failed"));

    expect(await send(createResponse)).toMatchObject({ ok: false, reason: "network-error" });
  });

  it("survives something thrown that is not an Error", async () => {
    const { createResponse } = threw("connection reset");

    expect(await send(createResponse)).toMatchObject({ ok: false, reason: "network-error" });
  });

  /*
   * A failure message reaches a reader. The thrown value can quote the request,
   * the endpoint, or a fragment of the key, so none of it is copied forward.
   */
  it("never repeats what was thrown", async () => {
    const { createResponse } = threw(
      Object.assign(new Error("401 from https://api.example.com key sk-proj-SECRET"), {
        status: 401,
      }),
    );

    const result = await send(createResponse);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.notice).not.toContain("sk-proj-SECRET");
    expect(result.notice).not.toContain("https://");
  });

  it("repeats nothing from a throw that never carried a status either", async () => {
    const { createResponse } = threw(
      new Error("connect ECONNREFUSED https://api.example.com/v1/responses?key=SECRET"),
    );

    const result = await send(createResponse);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.notice).not.toContain("SECRET");
    expect(result.notice).not.toContain("https://");
    expect(result.notice).not.toContain("ECONNREFUSED");
  });
});
