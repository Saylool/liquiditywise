import { describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../uniswap/v3SubgraphTransport";
import { fetchSourcifyAnswer, readSourcifyAnswer, SOURCIFY_TIMEOUT_MS, sourcifyContractUrl, sourcifyPage } from "./sourcify";

/* Answers as Sourcify gave them on 2026-10-04, for hooks the live directory listed. */
const LAUNCH_HOOK = "0x322dcec4958c14e021a9f1cd49df11b9457968cc";
const EXACT = {
  compilation: { name: "LaunchHook" },
  matchId: "47153654",
  creationMatch: "exact_match",
  runtimeMatch: "exact_match",
  verifiedAt: "2026-09-05T12:04:02Z",
  match: "exact_match",
  chainId: "1",
  address: "0x322dcEc4958C14e021A9F1cD49DF11b9457968cC",
};
const PARTIAL = { ...EXACT, compilation: { name: "PoolManager" }, match: "match", creationMatch: "match", runtimeMatch: "match" };
const NOT_VERIFIED = { match: null, creationMatch: null, runtimeMatch: null, chainId: "10", address: "0x7098Bf7DFF80532aa6bbDB52DF4Ac4992Bec3A80" };

const answered = (status: number, body: unknown) => ({ answered: true as const, status, body });

describe("reading what Sourcify says", () => {
  it("reads an exact match as verified, with the contract's name from its source", () => {
    expect(readSourcifyAnswer(answered(200, EXACT))).toEqual({ kind: "verified", name: "LaunchHook", proxy: null });
  });

  /* Uniswap's own PoolManager is a "match": the metadata hash differs, the code does not. */
  it("reads a match whose metadata differs as verified too", () => {
    expect(readSourcifyAnswer(answered(200, PARTIAL))).toEqual({ kind: "verified", name: "PoolManager", proxy: null });
  });

  it("reads verified source without a name it was asked for as verified and nameless", () => {
    const withoutName = { ...EXACT, compilation: undefined };

    expect(readSourcifyAnswer(answered(200, withoutName))).toEqual({ kind: "verified", name: null, proxy: null });
    expect(readSourcifyAnswer(answered(200, { ...EXACT, compilation: { name: "Not a name" } }))).toEqual({
      kind: "verified",
      name: null,
      proxy: null,
    });
  });

  it("reads its 404 as not verified, because that is how it says so", () => {
    expect(readSourcifyAnswer(answered(404, NOT_VERIFIED))).toEqual({ kind: "unverified", proxy: null });
    expect(readSourcifyAnswer(answered(200, NOT_VERIFIED))).toEqual({ kind: "unverified", proxy: null });
  });

  /* A moved endpoint answers 404 too; reading that as a verdict would put "not found" under every hook. */
  it("does not read a 404 in any other shape as a verdict", () => {
    expect(readSourcifyAnswer(answered(404, { message: "Not Found" }))).toEqual({ kind: "unanswered", why: "unreadable" });
    expect(readSourcifyAnswer(answered(404, undefined))).toEqual({ kind: "unanswered", why: "unreadable" });
  });

  it("does not read a kind of match it does not know, or a body it cannot read, as either verdict", () => {
    for (const body of [{ ...EXACT, match: "perfect" }, { ...EXACT, match: "partial" }, {}, [], "verified", undefined]) {
      expect(readSourcifyAnswer(answered(200, body)), JSON.stringify(body)).toEqual({ kind: "unanswered", why: "unreadable" });
    }
  });

  it("tells a service having a moment from one refusing this server, and both from an unsupported question", () => {
    expect(readSourcifyAnswer(answered(429, {}))).toEqual({ kind: "unanswered", why: "busy" });
    expect(readSourcifyAnswer(answered(503, {}))).toEqual({ kind: "unanswered", why: "busy" });
    expect(readSourcifyAnswer(answered(403, {}))).toEqual({ kind: "unanswered", why: "refused" });
    expect(readSourcifyAnswer(answered(400, { customCode: "unsupported_chain" }))).toEqual({ kind: "unanswered", why: "unreadable" });
  });

  it("passes on why no answer came", () => {
    expect(readSourcifyAnswer({ answered: false, why: "timeout" })).toEqual({ kind: "unanswered", why: "timeout" });
    expect(readSourcifyAnswer({ answered: false, why: "unreachable" })).toEqual({ kind: "unanswered", why: "unreachable" });
  });
});

describe("asking Sourcify", () => {
  const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it("asks for one contract on one chain, with its name, and nothing more", async () => {
    const fetchImpl = vi.fn<FetchLike>(json(200, EXACT));

    await fetchSourcifyAnswer({ chainId: 1, address: LAUNCH_HOOK, fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`https://sourcify.dev/server/v2/contract/1/${LAUNCH_HOOK}?fields=compilation.name`);
    expect(url).toBe(sourcifyContractUrl(1, LAUNCH_HOOK));
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
    expect(init?.headers).toEqual({ Accept: "application/json" });
  });

  it("answers verified for a 200 and not verified for its 404", async () => {
    expect(await fetchSourcifyAnswer({ chainId: 1, address: LAUNCH_HOOK, fetchImpl: json(200, EXACT) })).toEqual({
      kind: "verified",
      name: "LaunchHook",
      proxy: null,
    });
    expect(await fetchSourcifyAnswer({ chainId: 10, address: LAUNCH_HOOK, fetchImpl: json(404, NOT_VERIFIED) })).toEqual({
      kind: "unverified",
      proxy: null,
    });
  });

  it("answers unreadable for a body that is not JSON", async () => {
    const fetchImpl: FetchLike = async () => new Response("<html>Bad gateway</html>", { status: 200 });

    expect(await fetchSourcifyAnswer({ chainId: 1, address: LAUNCH_HOOK, fetchImpl })).toEqual({ kind: "unanswered", why: "unreadable" });
  });

  it("gives up at its deadline and says so, rather than waiting on a service that has stopped", async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });

    expect(await fetchSourcifyAnswer({ chainId: 1, address: LAUNCH_HOOK, fetchImpl, timeoutMs: 5 })).toEqual({
      kind: "unanswered",
      why: "timeout",
    });
  });

  /* How the pages ask it: with no deadline of their own, so this one is all there is. */
  it("keeps a deadline of its own when the caller gives none", async () => {
    vi.useFakeTimers();
    try {
      const silent: FetchLike = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      let settled = false;
      const answer = fetchSourcifyAnswer({ chainId: 1, address: LAUNCH_HOOK, fetchImpl: silent }).finally(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(SOURCIFY_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
      expect(await answer).toEqual({ kind: "unanswered", why: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers unreachable for a request that never completed", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };

    expect(await fetchSourcifyAnswer({ chainId: 1, address: LAUNCH_HOOK, fetchImpl })).toEqual({ kind: "unanswered", why: "unreachable" });
  });

  it("links a reader to the source on Sourcify's own pages", () => {
    expect(sourcifyPage(130, LAUNCH_HOOK)).toBe(`https://repo.sourcify.dev/130/${LAUNCH_HOOK}`);
  });
});
