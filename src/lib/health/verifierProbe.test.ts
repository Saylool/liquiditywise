import { describe, expect, it } from "vitest";

import { fakeStore } from "../telegram/fakeStore";
import type { SourceAnswer } from "../verification/sourceAnswer";
import { problemsFrom, VERIFIER_FAILING_LIMIT_MS } from "./problems";
import {
  classifyVerifierAnswer,
  PROBE_INTERVAL_MS,
  readUpstreamReport,
  type ProbeDependencies,
  type VerifierName,
  verifierFailures,
} from "./upstreamProbe";

const NOW_MS = new Date("2026-10-04T12:00:00.000Z").getTime();
const POOL_MANAGER: SourceAnswer = { kind: "verified", name: "PoolManager", proxy: null };

describe("what a verifier said about a contract it is known to hold verified", () => {
  it("is fine when it says verified", () => {
    expect(classifyVerifierAnswer(POOL_MANAGER)).toBe("ok");
  });

  it("is unrecognised when it says not verified, or says something that is not read", () => {
    expect(classifyVerifierAnswer({ kind: "unverified", proxy: null })).toBe("unrecognised");
    expect(classifyVerifierAnswer({ kind: "unanswered", why: "unreadable" })).toBe("unrecognised");
  });

  it("is refused when it turns this server away", () => {
    expect(classifyVerifierAnswer({ kind: "unanswered", why: "refused" })).toBe("refused");
  });

  it("is only unanswered when the service is having a moment", () => {
    for (const why of ["timeout", "unreachable", "busy"] as const) {
      expect(classifyVerifierAnswer({ kind: "unanswered", why }), why).toBe("unanswered");
    }
  });
});

const deps = (nowMs: number, answers: Partial<Record<VerifierName, SourceAnswer | Error>>): ProbeDependencies => ({
  probeMarketData: async () => 200,
  probeChainData: async () => 200,
  probeVerifiers: Object.fromEntries(
    Object.entries(answers).map(([name, answer]) => [
      name,
      async () => {
        if (answer instanceof Error) throw answer;
        return answer;
      },
    ]),
  ),
  now: () => new Date(nowMs),
});

describe("the verifiers in the hourly report", () => {
  it("asks each one it is given, and reads one that throws as unanswered", async () => {
    const report = await readUpstreamReport(
      null,
      deps(NOW_MS, { sourcify: POOL_MANAGER, "blockscout-base": { kind: "unverified", proxy: null }, "blockscout-polygon": new Error("down") }),
    );

    expect(report?.verifiers).toEqual({
      sourcify: { status: "ok", failingSinceMs: null },
      "blockscout-base": { status: "unrecognised", failingSinceMs: NOW_MS },
      "blockscout-polygon": { status: "unanswered", failingSinceMs: null },
    });
  });

  it("keeps the moment a failure began across probes, and forgets it once the verifier recovers", async () => {
    const store = fakeStore();
    const refusing = { "blockscout-unichain": { kind: "unanswered", why: "refused" } } as const;

    await readUpstreamReport(store, deps(NOW_MS, refusing));
    const later = await readUpstreamReport(store, deps(NOW_MS + PROBE_INTERVAL_MS, refusing));
    expect(later?.verifiers?.["blockscout-unichain"]).toEqual({ status: "refused", failingSinceMs: NOW_MS });

    const recovered = await readUpstreamReport(store, deps(NOW_MS + 2 * PROBE_INTERVAL_MS, { "blockscout-unichain": POOL_MANAGER }));
    expect(recovered?.verifiers?.["blockscout-unichain"]).toEqual({ status: "ok", failingSinceMs: null });
  });

  it("reads a stored report back, one stored before the verifiers as having none, and drops what it does not recognise", async () => {
    const store = fakeStore();
    await readUpstreamReport(store, deps(NOW_MS, { sourcify: { kind: "unanswered", why: "unreadable" } }));
    expect((await readUpstreamReport(store, deps(NOW_MS + 1, {})))?.verifiers).toEqual({
      sourcify: { status: "unrecognised", failingSinceMs: NOW_MS },
    });

    const old = fakeStore();
    old.data.set(
      "liquiditywise:health:upstream",
      JSON.stringify({
        marketData: "ok",
        chainData: "ok",
        atMs: NOW_MS,
        verifiers: { sourcify: { status: "fine", failingSinceMs: null }, "blockscout-base": { status: "refused", failingSinceMs: "today" } },
      }),
    );
    expect((await readUpstreamReport(old, deps(NOW_MS + 1, {})))?.verifiers).toEqual({});
  });

  it("says, per failing verifier, for how long by the report's own clock", () => {
    expect(
      verifierFailures({
        marketData: "ok",
        chainData: "ok",
        atMs: NOW_MS,
        verifiers: {
          sourcify: { status: "unrecognised", failingSinceMs: NOW_MS - 90 * 60_000 },
          "blockscout-ethereum": { status: "ok", failingSinceMs: null },
        },
      }),
    ).toEqual({ sourcify: { status: "unrecognised", forMs: 90 * 60_000 } });
  });
});

describe("a verifier that has changed or turned this server away", () => {
  it("is a problem once two hourly probes in a row agree, naming the service and the file that reads it", () => {
    const problems = problemsFrom({ verifierFailures: { sourcify: { status: "unrecognised", forMs: VERIFIER_FAILING_LIMIT_MS } } });

    expect(problems.map(({ id }) => id)).toEqual(["sourcify-verifier-failing"]);
    expect(problems[0]?.message).toContain("Sourcify (sourcify.dev)");
    expect(problems[0]?.message).toContain("src/lib/verification/sourcify.ts");
    expect(problems[0]?.message).toContain("on every network");
    expect(problems[0]?.message).toContain("60 minutes");
  });

  it("says a refusal is a refusal, and which network's hooks go unchecked", () => {
    const [problem] = problemsFrom({
      verifierFailures: { "blockscout-optimism": { status: "refused", forMs: VERIFIER_FAILING_LIMIT_MS } },
    });

    expect(problem?.id).toBe("blockscout-optimism-verifier-failing");
    expect(problem?.message).toContain("401/403");
    expect(problem?.message).toContain("explorer.optimism.io");
    expect(problem?.message).toContain("on OP Mainnet");
  });

  it("is not a problem on its first strange answer, nor ever for a service having a moment", () => {
    expect(problemsFrom({ verifierFailures: { sourcify: { status: "unrecognised", forMs: VERIFIER_FAILING_LIMIT_MS - 1 } } })).toEqual([]);
    expect(problemsFrom({ verifierFailures: { sourcify: { status: "unanswered", forMs: 10 * VERIFIER_FAILING_LIMIT_MS } } })).toEqual([]);
  });
});
