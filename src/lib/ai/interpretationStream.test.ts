import { describe, expect, it, vi } from "vitest";

import { DEFAULT_INTERPRETATION_MODEL, INTERPRETATION_REASONING_EFFORT } from "./interpretationModel";
import { SECTION_KEYS, type SectionKey } from "./interpretationSections";
import {
  type InterpretationStreamEvent,
  type StreamCreator,
  streamInterpretation,
} from "./interpretationTransport";

const PROMPT = { system: "system", user: "user" };
const PROSE = "The suggested range is a band of prices with the current price inside it, drawn from how far this pair has moved.";

/** The answer as the provider sends it: one JSON object, in pieces. */
const answer = (overrides: Partial<Record<SectionKey, string>> = {}) =>
  JSON.stringify(
    Object.fromEntries(SECTION_KEYS.map((key) => [key, overrides[key] ?? `${PROSE} (${key})`])),
  );

/**
 * A stream of `pieces` text deltas, then the finished response.
 *
 * Every text delta is preceded by a delta of another kind, because a provider
 * sends several: a reasoning summary is written the same way and carries the
 * same field. Anything but the answer's own text belongs to something else and
 * must not land in it.
 */
const streaming = (pieces: readonly string[], final: unknown = undefined): StreamCreator => {
  const text = pieces.join("");

  return async () =>
    (async function* stream(): AsyncGenerator<InterpretationStreamEvent> {
      for (const delta of pieces) {
        yield { type: "response.reasoning_summary_text.delta", delta: "thinking about it" };
        yield { type: "response.output_text.delta", delta };
      }
      if (final === null) return;
      yield {
        type: "response.completed",
        response: (final ?? { output_text: text, model: "gpt-5.6-luna-2026-09-01" }) as never,
      };
    })();
};

const run = (createStream: StreamCreator, onSection = vi.fn()) => ({
  onSection,
  result: streamInterpretation({
    prompt: PROMPT,
    apiKey: "test-openai-key-must-never-leak",
    model: DEFAULT_INTERPRETATION_MODEL,
    createStream,
    onSection,
  }),
});

describe("streamInterpretation", () => {
  it("asks for the answer as a stream, with the same model, ceiling and effort", async () => {
    const createStream = vi.fn(streaming([answer()]));
    await run(createStream).result;
    const [params] = vi.mocked(createStream).mock.calls[0] ?? [];

    expect(params?.stream).toBe(true);
    expect(params?.model).toBe(DEFAULT_INTERPRETATION_MODEL);
    expect(params?.reasoning).toEqual({ effort: INTERPRETATION_REASONING_EFFORT });
    expect(params?.input).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "user" },
    ]);
  });

  /*
   * The point of the whole path: a paragraph reaches the page when its closing
   * quote arrives, not when the last paragraph does.
   */
  it("hands on each section as it finishes, in the order it was written", async () => {
    const whole = answer();
    const half = whole.indexOf("ifPriceLeavesTheRange");
    const { onSection, result } = run(streaming([whole.slice(0, half), whole.slice(half)]));
    await result;

    expect(onSection.mock.calls.map(([key]) => key)).toEqual([...SECTION_KEYS]);
    expect(onSection.mock.calls[0]?.[1]).toContain("whatThisRangeMeans");
  });

  it("hands on nothing until a section has actually finished", async () => {
    const { onSection, result } = run(streaming(['{"whatThisRangeMeans":"The range is', ' a band"}']));
    await result;

    expect(onSection.mock.calls.map(([key]) => key)).toEqual([]);
  });

  /* A section that breaks the rule is never released early; the answer is refused as a whole later. */
  it("holds back a finished section that states a figure", async () => {
    const { onSection, result } = run(streaming([answer({ whatThisRangeMeans: `${PROSE} It is 3,000 USDC.` })]));
    await result;

    expect(onSection.mock.calls.map(([key]) => key)).not.toContain("whatThisRangeMeans");
    expect(onSection.mock.calls.map(([key]) => key)).toContain("ifPriceLeavesTheRange");
  });

  /* A reasoning summary arrives as deltas too, and is not part of the answer. */
  it("takes only the answer's own text, not every delta the provider sends", async () => {
    const { onSection, result } = run(streaming([answer()]));
    const settled = await result;

    expect(settled.ok && settled.text).toBe(answer());
    expect(onSection.mock.calls.map(([key]) => key)).toEqual([...SECTION_KEYS]);
    expect(JSON.stringify(onSection.mock.calls)).not.toContain("thinking about it");
  });

  it("returns the finished answer, with the model the provider named", async () => {
    const { result } = run(streaming([answer()]));

    await expect(result).resolves.toMatchObject({
      ok: true,
      stopReason: "end_turn",
      model: "gpt-5.6-luna-2026-09-01",
    });
  });

  it("falls back to the text it accumulated when the provider sends none", async () => {
    const { result } = run(streaming([answer()], { model: null }));
    const settled = await result;

    expect(settled.ok && settled.text).toBe(answer());
  });

  /* A stream that stops before the provider says it finished is a connection that dropped. */
  it("refuses an answer the provider never finished", async () => {
    const { result } = run(streaming(['{"whatThisRangeMeans":"' + PROSE + '"'], null));

    await expect(result).resolves.toEqual({
      ok: false,
      reason: "network-error",
      notice: "explanation-unreachable",
    });
  });

  it("reports a deployment with no key without opening a stream", async () => {
    const createStream = vi.fn(streaming([answer()]));
    const result = await streamInterpretation({
      prompt: PROMPT,
      apiKey: "   ",
      model: DEFAULT_INTERPRETATION_MODEL,
      createStream,
      onSection: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      reason: "configuration-error",
      notice: "explanation-not-configured",
    });
    expect(createStream).not.toHaveBeenCalled();
  });

  it.each([
    [401, "explanation-key-rejected"],
    [429, "explanation-rate-limited"],
    [500, "explanation-unreachable"],
  ])("maps a thrown %i onto its own notice", async (status, notice) => {
    const throwing: StreamCreator = async () => {
      throw Object.assign(new Error("refused"), { status });
    };

    await expect(run(throwing).result).resolves.toMatchObject({ ok: false, notice });
  });

  it("keeps the key out of a failure", async () => {
    const throwing: StreamCreator = async () => {
      throw new Error("test-openai-key-must-never-leak was refused");
    };

    await expect(JSON.stringify(await run(throwing).result)).not.toContain("must-never-leak");
  });
});
