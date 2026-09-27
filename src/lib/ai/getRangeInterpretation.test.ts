import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import { EXPLANATIONS_PER_HOUR } from "./explanationBudget";

/*
 * The boundary where a page's request meets the model, with the model and
 * everything behind it replaced: what is under test is the order of the checks
 * in front of it — the cache first, then the hourly ceiling, and only then a
 * request anybody pays for.
 */

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({ default: class {} }));

const asked = vi.hoisted(() => ({ streams: 0, requests: 0, failing: false }));

vi.mock("./interpretRange", () => {
  const written = {
    status: "success",
    data: { interpretation: { range: "a", exit: "b", measurement: "c", limits: "d" }, model: "gpt-5.6-luna" },
  };
  return {
    streamRange: async () => {
      asked.streams += 1;
      return written;
    },
    interpretRange: async () => {
      asked.requests += 1;
      return asked.failing ? { status: "unavailable", reason: "network-error", notice: "explanation-unreachable" } : written;
    },
  };
});

/** Enough of an analysis for the cache key and the log line, one per pool id. */
const analysis = (id: number): PoolRangeAnalysis =>
  ({
    pool: { chainId: 1, id: `0x${String(id).padStart(40, "0")}`, token0: { symbol: "USDC" }, token1: { symbol: "WETH" } },
    history: { pool: { protocolVersion: "v3", id: `0x${String(id).padStart(40, "0")}` } },
    range: { lowerTick: 0, upperTick: 10, containsCurrentPrice: true, lowerBoundTruncated: false, upperBoundTruncated: false },
    parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
  }) as unknown as PoolRangeAnalysis;

const request = (id: number) => ({ analysis: analysis(id), warnings: [], locale: "en" as const });

beforeEach(() => {
  vi.resetModules();
  /* The cache and the ceiling live on globalThis (processShared.ts), which a module reset does not clear. */
  const shared = globalThis as unknown as Record<symbol, unknown>;
  delete shared[Symbol.for("liquiditywise.interpretation-cache")];
  delete shared[Symbol.for("liquiditywise.explanation-budget")];
  asked.streams = 0;
  asked.requests = 0;
  asked.failing = false;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("asking for an explanation", () => {
  it("stops asking the model at the hourly ceiling, and says why in the explanation's place", async () => {
    const { streamRangeInterpretation } = await import("./getRangeInterpretation");

    for (let id = 1; id <= EXPLANATIONS_PER_HOUR; id += 1) await streamRangeInterpretation(request(id)).whole;
    const over = await streamRangeInterpretation(request(999)).whole;

    expect(asked.streams).toBe(EXPLANATIONS_PER_HOUR);
    expect(over).toEqual({ status: "unavailable", reason: "rate-limited", notice: "explanation-hourly-cap" });
  });

  it("still serves an answer already in the cache once the ceiling is reached, for nothing", async () => {
    const { streamRangeInterpretation } = await import("./getRangeInterpretation");

    await streamRangeInterpretation(request(1)).whole;
    for (let id = 2; id <= EXPLANATIONS_PER_HOUR; id += 1) await streamRangeInterpretation(request(id)).whole;
    const again = await streamRangeInterpretation(request(1)).whole;

    expect(again.status).toBe("success");
    expect(asked.streams).toBe(EXPLANATIONS_PER_HOUR);
  });

  it("closes every paragraph at once when held back, so no section spins", async () => {
    const { streamRangeInterpretation } = await import("./getRangeInterpretation");
    for (let id = 1; id <= EXPLANATIONS_PER_HOUR; id += 1) await streamRangeInterpretation(request(id)).whole;

    const held = streamRangeInterpretation(request(999));
    const sections = await Promise.all(Object.values(held.sections));

    expect(sections.every((section) => section.status === "missing")).toBe(true);
  });

  it("writes a line the weekly report counts, naming the pool and no one", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    const { streamRangeInterpretation } = await import("./getRangeInterpretation");
    for (let id = 1; id <= EXPLANATIONS_PER_HOUR; id += 1) await streamRangeInterpretation(request(id)).whole;

    await streamRangeInterpretation(request(999)).whole;

    expect(lines.filter((line) => line.startsWith("[interpretation] capped"))).toEqual([
      `[interpretation] capped pool=v3:0x${"999".padStart(40, "0")}`,
    ]);
  });

  it("holds the non-streaming path to the same ceiling", async () => {
    const { getRangeInterpretation } = await import("./getRangeInterpretation");

    for (let id = 1; id <= EXPLANATIONS_PER_HOUR; id += 1) await getRangeInterpretation(request(id));
    const over = await getRangeInterpretation(request(999));

    expect(asked.requests).toBe(EXPLANATIONS_PER_HOUR);
    expect(over.status === "unavailable" && over.notice).toBe("explanation-hourly-cap");
  });
});

describe("an explanation written ahead of its reader", () => {
  const logged = () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    return lines;
  };

  it("is written once, kept for the reader, and each serving of it is counted", async () => {
    const lines = logged();
    const { getRangeInterpretation, warmRangeInterpretation } = await import("./getRangeInterpretation");

    expect(await warmRangeInterpretation(request(7))).toBe("written");
    expect(await warmRangeInterpretation(request(7))).toBe("kept");
    await getRangeInterpretation(request(7));

    expect(asked.requests).toBe(1);
    expect(lines.filter((line) => line.startsWith("[interpretation] warmed"))).toHaveLength(1);
    expect(lines.filter((line) => line.startsWith("[interpretation] reused"))).toEqual([
      `[interpretation] reused pool=v3:0x${"7".padStart(40, "0")}`,
    ]);
  });

  it("counts a reader served from the cache on the streaming path too", async () => {
    const lines = logged();
    const { streamRangeInterpretation } = await import("./getRangeInterpretation");

    await streamRangeInterpretation(request(3)).whole;
    await streamRangeInterpretation(request(3)).whole;

    expect(lines.filter((line) => line.startsWith("[interpretation] reused"))).toHaveLength(1);
  });

  it("is not held to the readers' hourly ceiling, and does not use it up", async () => {
    const { getRangeInterpretation, warmRangeInterpretation } = await import("./getRangeInterpretation");
    for (let id = 1; id <= EXPLANATIONS_PER_HOUR; id += 1) await getRangeInterpretation(request(id));

    expect(await warmRangeInterpretation(request(999))).toBe("written");
  });

  it("leaves the readers' ceiling whole however much it writes", async () => {
    const { getRangeInterpretation, warmRangeInterpretation } = await import("./getRangeInterpretation");
    for (let id = 1000; id < 1010; id += 1) await warmRangeInterpretation(request(id));
    for (let id = 1; id <= EXPLANATIONS_PER_HOUR; id += 1) await getRangeInterpretation(request(id));

    expect(asked.requests).toBe(10 + EXPLANATIONS_PER_HOUR);
  });

  it("keeps nothing and says so when the model's answer did not come", async () => {
    const lines = logged();
    const { warmRangeInterpretation } = await import("./getRangeInterpretation");
    asked.failing = true;

    expect(await warmRangeInterpretation(request(5))).toBe("failed");
    expect(lines.some((line) => line.startsWith("[interpretation] warmed"))).toBe(false);
    asked.failing = false;
    expect(await warmRangeInterpretation(request(5))).toBe("written");
  });
});
