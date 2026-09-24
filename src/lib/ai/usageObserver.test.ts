import { describe, expect, it } from "vitest";

import { observeUsage, usageOf, type TokenUsage } from "./usageObserver";

type Event = { type: string; delta?: string; response?: { usage?: unknown } };

async function* events(...items: Event[]): AsyncIterable<Event> {
  for (const item of items) yield item;
}

const finished = (input: unknown, output: unknown): Event => ({
  type: "response.completed",
  response: { usage: { input_tokens: input, output_tokens: output } },
});

describe("watching a stream for what it cost", () => {
  it("passes every event through unchanged, and reports the counts once at the end", async () => {
    const seen: Event[] = [];
    const reported: TokenUsage[] = [];
    const stream = events({ type: "delta", delta: "a" }, { type: "delta", delta: "b" }, finished(1834, 612));

    for await (const event of observeUsage(stream, (usage) => reported.push(usage))) {
      seen.push(event);
      expect(reported).toEqual([]);
    }

    expect(seen.map((event) => event.type)).toEqual(["delta", "delta", "response.completed"]);
    expect(reported).toEqual([{ inputTokens: 1834, outputTokens: 612 }]);
  });

  it("still reports when the reader stops early", async () => {
    const reported: TokenUsage[] = [];
    for await (const event of observeUsage(events(finished(10, 2), { type: "delta" }), (usage) => reported.push(usage))) {
      if (event.type === "response.completed") break;
    }

    expect(reported).toEqual([{ inputTokens: 10, outputTokens: 2 }]);
  });

  it("reports nothing for a stream that never said", async () => {
    const reported: TokenUsage[] = [];
    for await (const event of observeUsage(events({ type: "delta" }), (usage) => reported.push(usage))) void event;

    expect(reported).toEqual([]);
  });

  it.each([
    [{ input_tokens: -1, output_tokens: 1 }],
    [{ input_tokens: 1.5, output_tokens: 1 }],
    [{ input_tokens: "12", output_tokens: 1 }],
    [{ output_tokens: 1 }],
    [null],
  ])("reads no counts from a usage it cannot trust: %j", (usage) => {
    expect(usageOf({ response: { usage } as never })).toBeNull();
  });
});
