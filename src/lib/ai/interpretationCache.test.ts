import { describe, expect, it } from "vitest";

import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import {
  createInterpretationCache,
  digestInstruction,
  type InterpretationCacheKeyInput,
  interpretationCacheKey,
} from "./interpretationCache";

/*
 * The key reads only the pool, the range and the band parameters, so the
 * fixture carries only those. Everything else in an analysis is a figure the
 * prose is forbidden to mention and therefore cannot depend on.
 */
const analysis = (overrides: {
  lowerTick?: number;
  upperTick?: number;
  containsCurrentPrice?: boolean;
  lowerBoundTruncated?: boolean;
  upperBoundTruncated?: boolean;
  horizonDays?: number;
  standardDeviationMultiplier?: number;
  poolId?: string;
  chainId?: number;
  currentPrice?: number;
} = {}) =>
  ({
    pool: { chainId: overrides.chainId ?? 1, id: overrides.poolId ?? `0x${"c".repeat(40)}` },
    range: {
      lowerTick: overrides.lowerTick ?? 195_960,
      upperTick: overrides.upperTick ?? 200_010,
      containsCurrentPrice: overrides.containsCurrentPrice ?? true,
      lowerBoundTruncated: overrides.lowerBoundTruncated ?? false,
      upperBoundTruncated: overrides.upperBoundTruncated ?? false,
    },
    band: { currentPrice: overrides.currentPrice ?? 0.000396 },
    parameters: {
      horizonDays: overrides.horizonDays ?? 30,
      standardDeviationMultiplier: overrides.standardDeviationMultiplier ?? 1,
    },
  }) as unknown as PoolRangeAnalysis;

const key = (overrides: Partial<InterpretationCacheKeyInput> = {}) =>
  interpretationCacheKey({
    analysis: analysis(),
    warnings: [],
    locale: "en",
    model: "gpt-5.6-luna",
    instruction: "Standing rules.",
    ...overrides,
  });

describe("interpretationCacheKey", () => {
  it("is the same for the same request", () => {
    expect(key()).toBe(key());
  });

  /*
   * The point of the whole design: the model cannot quote a price, so its prose
   * does not depend on one. A range that has not moved deserves the sentences
   * already written about it, whatever the numbers beside them now say.
   */
  it("ignores figures the prose is forbidden to mention", () => {
    expect(key({ analysis: analysis({ currentPrice: 0.000123 }) })).toBe(key());
  });

  it.each([
    ["a different pool", { analysis: analysis({ poolId: `0x${"d".repeat(40)}` }) }],
    ["another chain", { analysis: analysis({ chainId: 8453 }) }],
    ["a moved lower bound", { analysis: analysis({ lowerTick: 195_900 }) }],
    ["a moved upper bound", { analysis: analysis({ upperTick: 200_100 }) }],
    ["price having left the range", { analysis: analysis({ containsCurrentPrice: false }) }],
    ["a truncated lower edge", { analysis: analysis({ lowerBoundTruncated: true }) }],
    ["a truncated upper edge", { analysis: analysis({ upperBoundTruncated: true }) }],
    ["a different horizon", { analysis: analysis({ horizonDays: 365 }) }],
    ["a different multiplier", { analysis: analysis({ standardDeviationMultiplier: 2 }) }],
    ["another language", { locale: "tr" as const }],
    ["another model", { model: "gpt-5.6-terra" }],
    ["an edited instruction", { instruction: "Standing rules, revised." }],
    ["a caveat that now applies", { warnings: ["history-window-incomplete"] as const }],
  ])("changes for %s", (_label, overrides) => {
    expect(key(overrides)).not.toBe(key());
  });

  /*
   * A caveat used to be a sentence, and a sentence can contain whatever
   * character the parts were joined on — so the parts are escaped rather than
   * joined. They are codes now and cannot contain a separator at all, which
   * makes this belt and braces; the escaping stays because the key carries other
   * things that are not codes.
   */
  it("separates caveats unambiguously", () => {
    expect(key({ warnings: ["block-time-unreported", "history-window-incomplete"] })).not.toBe(
      key({ warnings: ["history-window-incomplete", "block-time-unreported"] }),
    );
    expect(key({ warnings: ["block-time-unreported"] })).not.toBe(key({ warnings: [] }));
  });
});

describe("digestInstruction", () => {
  it("is stable for the same text", () => {
    expect(digestInstruction("NEVER STATE A FIGURE")).toBe(digestInstruction("NEVER STATE A FIGURE"));
  });

  it("changes when a single character does", () => {
    expect(digestInstruction("rules")).not.toBe(digestInstruction("rulez"));
    expect(digestInstruction("rules")).not.toBe(digestInstruction("rules "));
  });

  it("survives an empty instruction", () => {
    expect(() => digestInstruction("")).not.toThrow();
  });
});

describe("createInterpretationCache", () => {
  const clock = (startedAt = 1_000_000) => {
    let current = startedAt;
    return { now: () => current, advance: (ms: number) => (current += ms) };
  };

  const cache = (ttlMs = 60_000, maxEntries = 100) => {
    const time = clock();
    return { time, subject: createInterpretationCache<string>({ ttlMs, maxEntries, now: time.now }) };
  };

  it("returns nothing for a key it has never seen", () => {
    const { subject } = cache();

    expect(subject.get("absent")).toBeUndefined();
  });

  it("gives back what it was given", () => {
    const { subject } = cache();
    subject.set("a", "prose");

    expect(subject.get("a")).toBe("prose");
  });

  it("stops serving an entry once its time is up", () => {
    const { time, subject } = cache(60_000);
    subject.set("a", "prose");

    time.advance(59_999);
    expect(subject.get("a")).toBe("prose");

    time.advance(1);
    // Exactly one lifetime later, not one millisecond after.
    expect(subject.get("a")).toBeUndefined();
  });

  it("forgets an expired entry rather than holding it", () => {
    const { time, subject } = cache(60_000);
    subject.set("a", "prose");
    time.advance(60_000);

    subject.get("a");
    expect(subject.size()).toBe(0);
  });

  it("keeps the table under its ceiling", () => {
    const { subject } = cache(60_000, 10);

    for (let index = 0; index < 500; index += 1) subject.set(`key-${index}`, "prose");

    expect(subject.size()).toBeLessThanOrEqual(10);
  });

  it("evicts the entry written longest ago", () => {
    const { subject } = cache(60_000, 3);
    subject.set("first", "1");
    subject.set("second", "2");
    subject.set("third", "3");

    subject.set("fourth", "4");

    expect(subject.get("first")).toBeUndefined();
    expect(subject.get("fourth")).toBe("4");
  });

  it("moves a rewritten entry to the back of the queue", () => {
    const { subject } = cache(60_000, 3);
    subject.set("a", "1");
    subject.set("b", "2");
    subject.set("a", "rewritten");

    subject.set("c", "3");
    subject.set("d", "4");

    // b was the oldest surviving entry, so b is the one that went.
    expect(subject.get("b")).toBeUndefined();
    expect(subject.get("a")).toBe("rewritten");
  });
});
