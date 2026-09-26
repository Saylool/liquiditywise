import { describe, expect, it } from "vitest";

import { fakeStore } from "../telegram/fakeStore";
import { problemsFrom } from "./problems";
import {
  classifyProbeStatus,
  isProbeDue,
  PROBE_INTERVAL_MS,
  readUpstreamReport,
  type ProbeDependencies,
} from "./upstreamProbe";

const NOW = new Date("2026-09-22T12:00:00.000Z");

const deps = (market: number | Error, chain: number | Error, now: Date = NOW): ProbeDependencies => ({
  probeMarketData: async () => {
    if (market instanceof Error) throw market;
    return market;
  },
  probeChainData: async () => {
    if (chain instanceof Error) throw chain;
    return chain;
  },
  now: () => now,
});

describe("what an upstream's answer means", () => {
  /*
   * The same reading both transports already make. A monitor that disagreed
   * with the application about what 403 means would send someone looking for
   * a fault the application had called something else.
   */
  it("reads the credential statuses the way the transports do", () => {
    expect(classifyProbeStatus(401)).toBe("credentials-rejected");
    expect(classifyProbeStatus(403)).toBe("credentials-rejected");
    expect(classifyProbeStatus(429)).toBe("rate-limited");
    expect(classifyProbeStatus(200)).toBe("ok");
  });

  it("treats a server fault and a refusal to connect as the same unreachable", () => {
    expect(classifyProbeStatus(500)).toBe("unreachable");
    expect(classifyProbeStatus(502)).toBe("unreachable");
    expect(classifyProbeStatus(0)).toBe("unreachable");
  });

  /*
   * Only the refusal is reported. A rate limit passes on its own and a
   * provider having a bad minute is not something the operator can act on;
   * paging for either would teach them to ignore the one that matters.
   */
  it("reports only the refusal, of all four", () => {
    const ids = (status: Parameters<typeof problemsFrom>[0]) =>
      problemsFrom(status).map((problem) => problem.id);

    expect(ids({ marketDataStatus: "credentials-rejected" })).toEqual(["market-data-key-refused"]);
    expect(ids({ marketDataStatus: "rate-limited" })).toEqual([]);
    expect(ids({ marketDataStatus: "unreachable" })).toEqual([]);
    expect(ids({ marketDataStatus: "ok" })).toEqual([]);
    expect(ids({})).toEqual([]);
  });

  it("tells the two sources apart, because they are two dashboards", () => {
    const [market] = problemsFrom({ marketDataStatus: "credentials-rejected" });
    const [chain] = problemsFrom({ chainDataStatus: "credentials-rejected" });

    expect(market?.message).toContain("THE_GRAPH_API_KEY");
    expect(chain?.message).toContain("ETHEREUM_RPC_URL");
    expect(problemsFrom({ marketDataStatus: "credentials-rejected", chainDataStatus: "credentials-rejected" })).toHaveLength(2);
  });
});

describe("how often the question is worth asking", () => {
  it("asks when nothing has been asked before", () => {
    expect(isProbeDue(null, NOW.getTime())).toBe(true);
  });

  it("does not ask again inside the hour", () => {
    const previous = { marketData: "ok", chainData: "ok", atMs: NOW.getTime() } as const;

    expect(isProbeDue(previous, NOW.getTime() + PROBE_INTERVAL_MS - 1)).toBe(false);
    expect(isProbeDue(previous, NOW.getTime() + PROBE_INTERVAL_MS)).toBe(true);
  });
});

describe("taking the reading", () => {
  it("probes and keeps the answer", async () => {
    const store = fakeStore();

    const report = await readUpstreamReport(store, deps(200, 200));

    expect(report).toMatchObject({ marketData: "ok", chainData: "ok", atMs: NOW.getTime() });
    expect(store.data.size).toBe(1);
  });

  /* The whole point of storing it: the second pass within the hour is free. */
  it("reuses the stored answer instead of asking again", async () => {
    const store = fakeStore();
    await readUpstreamReport(store, deps(401, 200));

    let asked = 0;
    const counted: ProbeDependencies = {
      probeMarketData: async () => { asked += 1; return 200; },
      probeChainData: async () => { asked += 1; return 200; },
      now: () => new Date(NOW.getTime() + PROBE_INTERVAL_MS - 1),
    };
    const report = await readUpstreamReport(store, counted);

    expect(asked).toBe(0);
    expect(report?.marketData).toBe("credentials-rejected");
  });

  it("asks again once the hour is up", async () => {
    const store = fakeStore();
    await readUpstreamReport(store, deps(401, 401));

    const later = await readUpstreamReport(store, deps(200, 200, new Date(NOW.getTime() + PROBE_INTERVAL_MS)));

    expect(later).toMatchObject({ marketData: "ok", chainData: "ok" });
  });

  /*
   * One source failing says nothing about the other. Letting a thrown request
   * take the whole probe down would report the Graph key as refused because
   * the RPC endpoint timed out, and send someone to the wrong dashboard.
   */
  it("keeps the two apart when one of them throws", async () => {
    const store = fakeStore();

    const report = await readUpstreamReport(store, deps(new Error("socket hang up"), 200));

    expect(report).toMatchObject({ marketData: "unreachable", chainData: "ok" });
  });

  it("still answers without a store, and asks every time", async () => {
    const report = await readUpstreamReport(null, deps(403, 200));

    expect(report).toMatchObject({ marketData: "credentials-rejected", chainData: "ok" });
  });

  /*
   * A value that is not a report cannot have come from a probe. Reading it as
   * one would report whatever it happened to contain; treating it as nothing
   * costs one extra query and tells the truth.
   */
  it("ignores stored junk and probes instead", async () => {
    const store = fakeStore();
    store.data.set("liquiditywise:health:upstream", "not json at all");

    const report = await readUpstreamReport(store, deps(200, 200));

    expect(report).toMatchObject({ marketData: "ok", chainData: "ok" });
  });

  it("ignores a stored report whose fields are not statuses it knows", async () => {
    const store = fakeStore();
    store.data.set(
      "liquiditywise:health:upstream",
      JSON.stringify({ marketData: "fine", chainData: "ok", atMs: NOW.getTime() }),
    );

    const report = await readUpstreamReport(store, deps(401, 200));

    expect(report?.marketData).toBe("credentials-rejected");
  });

  /* A store that cannot answer must not look like a fresh clean report. */
  it("probes when the store will not answer", async () => {
    const store = fakeStore();
    store.down = true;

    const report = await readUpstreamReport(store, deps(401, 200));

    expect(report?.marketData).toBe("credentials-rejected");
  });
});

describe("the other chains' endpoints", () => {
  const withOthers = (base: number, arbitrum?: number): ProbeDependencies => ({
    ...deps(200, 200),
    probeOtherChains: {
      base: async () => base,
      ...(arbitrum === undefined ? {} : { arbitrum: async () => arbitrum }),
    },
  });

  it("asks each configured one on its own, and none that is not configured", async () => {
    const report = await readUpstreamReport(null, withOthers(403));

    expect(report?.otherChains).toEqual({ base: "credentials-rejected" });
    expect(report?.chainData).toBe("ok");
  });

  it("keeps their answers with the rest, for the hour", async () => {
    const store = fakeStore();
    await readUpstreamReport(store, withOthers(200, 401));
    const kept = await readUpstreamReport(store, deps(500, 500));

    expect(kept?.otherChains).toEqual({ base: "ok", arbitrum: "credentials-rejected" });
  });

  it("reads a report stored before other chains as having none", async () => {
    const store = fakeStore();
    store.data.set(
      "liquiditywise:health:upstream",
      JSON.stringify({ marketData: "ok", chainData: "ok", atMs: NOW.getTime() }),
    );

    expect((await readUpstreamReport(store, deps(500, 500)))?.otherChains).toEqual({});
  });

  it("lets one chain's endpoint failing to answer at all say nothing about another's", async () => {
    const report = await readUpstreamReport(null, {
      ...deps(200, 200),
      probeOtherChains: {
        base: async () => {
          throw new Error("down");
        },
        arbitrum: async () => 200,
      },
    });

    expect(report?.otherChains).toEqual({ base: "unreachable", arbitrum: "ok" });
  });
});

describe("a refused key on another chain", () => {
  it("is a problem of its own, naming the variable and the chain", () => {
    const problems = problemsFrom({ otherChainStatus: { base: "credentials-rejected", arbitrum: "ok" } });

    expect(problems.map(({ id }) => id)).toEqual(["base-rpc-key-refused"]);
    expect(problems[0]?.message).toContain("BASE_RPC_URL");
  });

  it("is not said for an endpoint that is only slow or down", () => {
    expect(problemsFrom({ otherChainStatus: { base: "rate-limited", arbitrum: "unreachable" } })).toEqual([]);
  });

  it("names Arbitrum's variable for Arbitrum", () => {
    const [problem] = problemsFrom({ otherChainStatus: { arbitrum: "credentials-rejected" } });

    expect(problem?.id).toBe("arbitrum-rpc-key-refused");
    expect(problem?.message).toContain("ARBITRUM_RPC_URL");
  });
});
