import { describe, expect, it, vi } from "vitest";

import {
  fetchV4HookPools,
  HOOK_POOL_COUNT_CAP,
  HOOK_POOLS_TIMEOUT_MS,
  readV4HookPools,
  V4_HOOK_POOLS_QUERY,
} from "./ethereumV4HookPools";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const SUBGRAPH_ID = "TestV4SubgraphId";
const HOOK = "0xa0b0d2d00fd544d8e0887f1a3cedd6e24baf10cc";

/* Unichain's Spot hook on 2026-10-04: eighteen pools, the first created 2025-06-08. */
const created = (...seconds: readonly (number | string)[]) => seconds.map((value) => ({ createdAtTimestamp: String(value) }));
const body = (pools: readonly unknown[], hasIndexingErrors = false) => ({ data: { pools, _meta: { hasIndexingErrors } } });

describe("reading how many pools name a hook", () => {
  it("counts the pools and dates the first of them", () => {
    expect(readV4HookPools(body(created(1749400004, 1750000000, 1760000000)))).toEqual({
      status: "counted",
      pools: 3,
      capped: false,
      firstCreatedAt: "2025-06-08T16:26:44.000Z",
    });
  });

  it("dates the hook by its earliest pool even when the source did not list that one first", () => {
    expect(readV4HookPools(body(created(1760000000, 1749400004, 1750000000)))).toMatchObject({
      firstCreatedAt: "2025-06-08T16:26:44.000Z",
    });
  });

  it("says the count is a floor once it reaches the cap, and not one pool before", () => {
    const atCap = created(...Array.from({ length: HOOK_POOL_COUNT_CAP }, (_unused, index) => 1749400004 + index));
    const underCap = atCap.slice(1);

    expect(readV4HookPools(body(atCap))).toMatchObject({ status: "counted", pools: HOOK_POOL_COUNT_CAP, capped: true });
    expect(readV4HookPools(body(underCap))).toMatchObject({ status: "counted", pools: HOOK_POOL_COUNT_CAP - 1, capped: false });
  });

  it("refuses more pools than it asked for, rather than counting them", () => {
    const over = created(...Array.from({ length: HOOK_POOL_COUNT_CAP + 1 }, () => 1749400004));

    expect(readV4HookPools(body(over))).toEqual({ status: "unchecked" });
  });

  it("counts none as none, with no date", () => {
    expect(readV4HookPools(body([]))).toEqual({ status: "counted", pools: 0, capped: false, firstCreatedAt: null });
  });

  /* A count from a subgraph that failed to index something could be short, and would not say so. */
  it("does not count from a subgraph reporting indexing errors", () => {
    expect(readV4HookPools(body(created(1749400004), true))).toEqual({ status: "unchecked" });
  });

  it("does not count from an answer that carries errors, no data, or a timestamp that is not one", () => {
    expect(readV4HookPools({ errors: [{ message: "bad indexers" }] })).toEqual({ status: "unchecked" });
    expect(readV4HookPools({ ...body(created(1749400004)), errors: [{ message: "partial" }] })).toEqual({ status: "unchecked" });
    expect(readV4HookPools({ data: null })).toEqual({ status: "unchecked" });
    expect(readV4HookPools(body(created("soon")))).toEqual({ status: "unchecked" });
    expect(readV4HookPools(body(created(0)))).toEqual({ status: "unchecked" });
    expect(readV4HookPools(body(created("99999999999999")))).toEqual({ status: "unchecked" });
    expect(readV4HookPools("not an answer")).toEqual({ status: "unchecked" });
  });
});

describe("asking the subgraph", () => {
  const respond = (payload: unknown, status = 200) => vi.fn<FetchLike>(async () => new Response(JSON.stringify(payload), { status }));

  it("asks for the hook's pools, oldest first, up to the cap, with the hook as a variable", async () => {
    const fetchImpl = respond(body(created(1749400004)));

    await fetchV4HookPools({ hook: HOOK, apiKey: API_KEY, subgraphId: SUBGRAPH_ID, fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID}`);
    expect(JSON.parse(String(init?.body))).toEqual({ query: V4_HOOK_POOLS_QUERY, variables: { hook: HOOK, cap: HOOK_POOL_COUNT_CAP } });
    expect(V4_HOOK_POOLS_QUERY).toContain("where: { hooks: $hook }");
    expect(V4_HOOK_POOLS_QUERY).toContain("orderBy: createdAtTimestamp, orderDirection: asc");
    /* Never in the URL. */
    expect(String(url)).not.toContain(API_KEY);
  });

  it("counts what comes back", async () => {
    expect(
      await fetchV4HookPools({ hook: HOOK, apiKey: API_KEY, subgraphId: SUBGRAPH_ID, fetchImpl: respond(body(created(1749400004))) }),
    ).toMatchObject({ status: "counted", pools: 1 });
  });

  it("asks nothing without a key or a subgraph", async () => {
    const fetchImpl = respond(body([]));

    expect(await fetchV4HookPools({ hook: HOOK, apiKey: undefined, subgraphId: SUBGRAPH_ID, fetchImpl })).toEqual({ status: "unchecked" });
    expect(await fetchV4HookPools({ hook: HOOK, apiKey: API_KEY, subgraphId: " ", fetchImpl })).toEqual({ status: "unchecked" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  /* How the pages ask it: with no deadline of their own, and the gateway's own gives up only at fifteen seconds. */
  it("keeps a deadline of its own when the caller gives none", async () => {
    vi.useFakeTimers();
    try {
      const silent: FetchLike = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      let settled = false;
      const usage = fetchV4HookPools({ hook: HOOK, apiKey: API_KEY, subgraphId: SUBGRAPH_ID, fetchImpl: silent }).finally(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(HOOK_POOLS_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
      expect(await usage).toEqual({ status: "unchecked" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("is unchecked when the gateway refuses, fails or does not answer in time", async () => {
    const silent: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });

    for (const fetchImpl of [respond({}, 429), respond({}, 500), respond({}, 401), silent]) {
      expect(await fetchV4HookPools({ hook: HOOK, apiKey: API_KEY, subgraphId: SUBGRAPH_ID, fetchImpl, timeoutMs: 5 })).toEqual({
        status: "unchecked",
      });
    }
  });
});
