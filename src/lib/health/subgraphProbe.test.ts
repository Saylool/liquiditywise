import { describe, expect, it } from "vitest";

import { fakeStore } from "../telegram/fakeStore";
import { problemsFrom, SUBGRAPH_FAILING_LIMIT_MS } from "./problems";
import {
  classifySubgraphAnswer,
  PROBE_INTERVAL_MS,
  readUpstreamReport,
  SUBGRAPH_LAG_LIMIT_MS,
  subgraphFailures,
  type ProbeDependencies,
} from "./upstreamProbe";

const NOW_MS = new Date("2026-09-27T12:00:00.000Z").getTime();
const NOW_S = NOW_MS / 1_000;

const healthy = (lagSeconds = 5, atS = NOW_S) => ({
  data: { _meta: { hasIndexingErrors: false, block: { timestamp: atS - lagSeconds } } },
});
const BAD_INDEXERS = { errors: [{ message: "bad indexers: {0xf92f…: BadResponse(no attestation: indexing_error)}" }] };

describe("what a subgraph's health field says", () => {
  it("is ok when it answers cleanly and close behind the chain", () => {
    expect(classifySubgraphAnswer(200, healthy(), NOW_MS)).toBe("ok");
  });

  it("is failing when the gateway answers with errors instead of data, as Base's v4 subgraph did", () => {
    expect(classifySubgraphAnswer(200, BAD_INDEXERS, NOW_MS)).toBe("errors");
    expect(classifySubgraphAnswer(200, { data: null }, NOW_MS)).toBe("errors");
    expect(classifySubgraphAnswer(200, { data: {} }, NOW_MS)).toBe("errors");
  });

  it("is failing when errors come beside data that looks healthy", () => {
    expect(classifySubgraphAnswer(200, { ...healthy(), errors: [{ message: "bad indexers" }] }, NOW_MS)).toBe("errors");
    expect(classifySubgraphAnswer(200, { ...healthy(), errors: [] }, NOW_MS)).toBe("ok");
  });

  it("does not read a lag from a timestamp that is not a number", () => {
    const body = { data: { _meta: { hasIndexingErrors: false, block: { timestamp: "0" } } } };

    expect(classifySubgraphAnswer(200, body, NOW_MS)).toBe("ok");
  });

  it("is failing when the subgraph says it has indexing errors", () => {
    const body = { data: { _meta: { hasIndexingErrors: true, block: { timestamp: NOW_S } } } };

    expect(classifySubgraphAnswer(200, body, NOW_MS)).toBe("indexing-errors");
  });

  it("is behind only past an hour, not at it", () => {
    const limit = SUBGRAPH_LAG_LIMIT_MS / 1_000;

    expect(classifySubgraphAnswer(200, healthy(limit), NOW_MS)).toBe("ok");
    expect(classifySubgraphAnswer(200, healthy(limit + 1), NOW_MS)).toBe("behind");
  });

  it("leaves anything but a 200 to the key probe, as unanswered", () => {
    expect(classifySubgraphAnswer(401, BAD_INDEXERS, NOW_MS)).toBe("unanswered");
    expect(classifySubgraphAnswer(0, null, NOW_MS)).toBe("unanswered");
    expect(classifySubgraphAnswer(200, "not json", NOW_MS)).toBe("unanswered");
  });
});

const deps = (
  nowMs: number,
  answers: Partial<Record<"v4-base" | "v4-arbitrum", { status: number; body: unknown } | Error>>,
): ProbeDependencies => ({
  probeMarketData: async () => 200,
  probeChainData: async () => 200,
  probeSubgraphs: Object.fromEntries(
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

describe("the subgraphs in the hourly report", () => {
  it("asks each configured one, and none that is not", async () => {
    const report = await readUpstreamReport(null, deps(NOW_MS, { "v4-base": { status: 200, body: BAD_INDEXERS } }));

    expect(report?.subgraphs).toEqual({ "v4-base": { status: "errors", failingSinceMs: NOW_MS } });
  });

  it("reads one that throws as unanswered, and lets it say nothing about another", async () => {
    const report = await readUpstreamReport(
      null,
      deps(NOW_MS, { "v4-base": new Error("down"), "v4-arbitrum": { status: 200, body: healthy() } }),
    );

    expect(report?.subgraphs).toEqual({
      "v4-base": { status: "unanswered", failingSinceMs: null },
      "v4-arbitrum": { status: "ok", failingSinceMs: null },
    });
  });

  it("keeps the moment a failure began across probes, and forgets it once the subgraph recovers", async () => {
    const store = fakeStore();
    const failing = { "v4-base": { status: 200, body: BAD_INDEXERS } };

    await readUpstreamReport(store, deps(NOW_MS, failing));
    const later = await readUpstreamReport(store, deps(NOW_MS + PROBE_INTERVAL_MS, failing));
    expect(later?.subgraphs?.["v4-base"]).toEqual({ status: "errors", failingSinceMs: NOW_MS });

    const recovered = await readUpstreamReport(
      store,
      deps(NOW_MS + 2 * PROBE_INTERVAL_MS, {
        "v4-base": { status: 200, body: healthy(5, (NOW_MS + 2 * PROBE_INTERVAL_MS) / 1_000) },
      }),
    );
    expect(recovered?.subgraphs?.["v4-base"]).toEqual({ status: "ok", failingSinceMs: null });
  });

  it("reads back a stored report's subgraphs, and a report stored before them as having none", async () => {
    const store = fakeStore();
    await readUpstreamReport(store, deps(NOW_MS, { "v4-base": { status: 200, body: BAD_INDEXERS } }));
    const kept = await readUpstreamReport(store, deps(NOW_MS + 1, {}));
    expect(kept?.subgraphs).toEqual({ "v4-base": { status: "errors", failingSinceMs: NOW_MS } });

    const old = fakeStore();
    old.data.set("liquiditywise:health:upstream", JSON.stringify({ marketData: "ok", chainData: "ok", atMs: NOW_MS }));
    expect((await readUpstreamReport(old, deps(NOW_MS + 1, {})))?.subgraphs).toEqual({});
  });

  it("drops a stored reading it does not recognise, rather than trusting it", async () => {
    const store = fakeStore();
    store.data.set(
      "liquiditywise:health:upstream",
      JSON.stringify({
        marketData: "ok",
        chainData: "ok",
        atMs: NOW_MS,
        subgraphs: {
          "v4-base": { status: "fine", failingSinceMs: null },
          "v4-arbitrum": { status: "errors", failingSinceMs: "yesterday" },
          "v3-base": { status: "behind", failingSinceMs: NOW_MS - 5 },
        },
      }),
    );

    expect((await readUpstreamReport(store, deps(NOW_MS + 1, {})))?.subgraphs).toEqual({
      "v3-base": { status: "behind", failingSinceMs: NOW_MS - 5 },
    });
  });

  it("says, per failing subgraph, for how long by the report's own clock", () => {
    const failures = subgraphFailures({
      marketData: "ok",
      chainData: "ok",
      atMs: NOW_MS,
      subgraphs: {
        "v4-base": { status: "errors", failingSinceMs: NOW_MS - 90 * 60_000 },
        "v4-arbitrum": { status: "ok", failingSinceMs: null },
      },
    });

    expect(failures).toEqual({ "v4-base": { status: "errors", forMs: 90 * 60_000 } });
  });
});

describe("a subgraph that has stopped answering", () => {
  it("is a problem once two hourly probes in a row agree, naming the setting and what is lost", () => {
    const problems = problemsFrom({ subgraphFailures: { "v4-base": { status: "errors", forMs: SUBGRAPH_FAILING_LIMIT_MS } } });

    expect(problems.map(({ id }) => id)).toEqual(["v4-base-subgraph-failing"]);
    expect(problems[0]?.message).toContain("UNISWAP_V4_BASE_SUBGRAPH_ID");
    expect(problems[0]?.message).toContain("bad indexers");
    expect(problems[0]?.message).toContain("60 minutes");
    expect(problems[0]?.message).toContain("Base v4 pool pages");
  });

  it("is not a problem on its first bad answer", () => {
    expect(problemsFrom({ subgraphFailures: { "v4-base": { status: "errors", forMs: SUBGRAPH_FAILING_LIMIT_MS - 1 } } })).toEqual([]);
    expect(problemsFrom({ subgraphFailures: { "v4-base": { status: "errors", forMs: 0 } } })).toEqual([]);
  });

  it("names each kind of failure in its own words", () => {
    const words = (status: "indexing-errors" | "behind") =>
      problemsFrom({ subgraphFailures: { "v3-arbitrum": { status, forMs: SUBGRAPH_FAILING_LIMIT_MS } } })[0]?.message;

    expect(words("indexing-errors")).toContain("indexing errors");
    expect(words("indexing-errors")).toContain("UNISWAP_V3_ARBITRUM_SUBGRAPH_ID");
    expect(words("behind")).toContain("more than an hour behind");
  });

  it("is never reported for an answer the key probe owns", () => {
    expect(
      problemsFrom({ subgraphFailures: { "v4-base": { status: "unanswered", forMs: 10 * SUBGRAPH_FAILING_LIMIT_MS } } }),
    ).toEqual([]);
  });
});
