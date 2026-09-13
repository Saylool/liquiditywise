import { describe, expect, it } from "vitest";

import { INTERPRETATION_MAX_TOKENS, INTERPRETATION_MODEL } from "./interpretationModel";
import {
  type InterpretationMessage,
  type MessageCreator,
  requestInterpretation,
} from "./interpretationTransport";

const prompt = { system: "Standing rules.", user: "POOL\n- Pair: USDC / WETH" };

const answered = (message: Partial<InterpretationMessage> = {}) => {
  const calls: Parameters<MessageCreator>[0][] = [];
  const createMessage: MessageCreator = async (params) => {
    calls.push(params);
    return {
      stop_reason: "end_turn",
      content: [{ type: "text", text: "{}" }],
      ...message,
    };
  };
  return { calls, createMessage };
};

const threw = (error: unknown) => {
  let called = 0;
  const createMessage: MessageCreator = async () => {
    called += 1;
    throw error;
  };
  return { calledCount: () => called, createMessage };
};

const send = (createMessage: MessageCreator) =>
  requestInterpretation({ prompt, apiKey: "sk-test", createMessage });

describe("requestInterpretation", () => {
  it("sends the model, the ceiling and both halves of the prompt", async () => {
    const { calls, createMessage } = answered();
    await send(createMessage);

    expect(calls).toHaveLength(1);
    const [params] = calls;
    expect(params?.model).toBe(INTERPRETATION_MODEL);
    expect(params?.max_tokens).toBe(INTERPRETATION_MAX_TOKENS);
    expect(params?.system).toBe(prompt.system);
    expect(params?.messages).toEqual([{ role: "user", content: prompt.user }]);
  });

  it("asks the API for the right shape", async () => {
    const { calls, createMessage } = answered();
    await send(createMessage);

    expect(calls[0]?.output_config?.format).toBeDefined();
  });

  it("passes back what the model said", async () => {
    const { createMessage } = answered({
      stop_reason: "end_turn",
      content: [{ type: "text", text: '{"ok":true}' }],
    });

    await expect(send(createMessage)).resolves.toEqual({
      ok: true,
      stopReason: "end_turn",
      text: '{"ok":true}',
    });
  });

  it("joins text across blocks and ignores the rest", async () => {
    const { createMessage } = answered({
      content: [
        { type: "thinking" },
        { type: "text", text: '{"part":' },
        { type: "text", text: '"two"}' },
      ],
    });

    const result = await send(createMessage);
    expect(result).toMatchObject({ ok: true, text: '{"part":"two"}' });
  });

  it("reports no text as none, rather than as an empty answer", async () => {
    const { createMessage } = answered({ content: [{ type: "thinking" }] });

    expect(await send(createMessage)).toMatchObject({ ok: true, text: null });
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
    const { calledCount, createMessage } = threw(new Error("should not be reached"));

    /*
     * Called directly rather than through the helper: a default parameter
     * cannot tell an argument that was omitted from one that was passed as
     * `undefined`, and `undefined` is precisely the case under test.
     */
    const result = await requestInterpretation({ prompt, apiKey, createMessage });

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
    const { createMessage } = threw(Object.assign(new Error("failed"), { status }));

    expect(await send(createMessage)).toMatchObject({ ok: false, reason });
  });

  it("treats a throw with no status as never having reached the service", async () => {
    const { createMessage } = threw(new Error("fetch failed"));

    expect(await send(createMessage)).toMatchObject({ ok: false, reason: "network-error" });
  });

  it("repeats nothing from a throw that never carried a status either", async () => {
    // A connection failure names the host it could not reach, and the endpoint
    // is the one place a key can appear in a URL.
    const { createMessage } = threw(
      new Error("connect ECONNREFUSED https://api.example.com/v1/messages?key=SECRET"),
    );

    const result = await send(createMessage);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain("SECRET");
    expect(result.message).not.toContain("https://");
    expect(result.message).not.toContain("ECONNREFUSED");
  });

  it("survives something thrown that is not an Error", async () => {
    const { createMessage } = threw("connection reset");

    expect(await send(createMessage)).toMatchObject({ ok: false, reason: "network-error" });
  });

  /*
   * A failure message reaches a reader. The thrown value can quote the request,
   * the endpoint, or a fragment of the key, so none of it is copied forward.
   */
  it("never repeats what was thrown", async () => {
    const { createMessage } = threw(
      Object.assign(new Error("401 from https://api.example.com key sk-ant-SECRET"), {
        status: 401,
      }),
    );

    const result = await send(createMessage);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain("sk-ant-SECRET");
    expect(result.message).not.toContain("https://");
  });
});
