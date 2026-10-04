import { describe, expect, it } from "vitest";

import type { FetchLike } from "../uniswap/v3SubgraphTransport";
import { getPublicJson } from "./publicJson";

const URL = "https://sourcify.dev/server/v2/contract/1/0x0000000000000000000000000000000000000001";

describe("one question to a keyless JSON API", () => {
  it("hands back the status and the decoded body, whatever the status", async () => {
    const fetchImpl: FetchLike = async () => new Response(JSON.stringify({ match: null }), { status: 404 });

    expect(await getPublicJson(URL, { fetchImpl, timeoutMs: 1_000 })).toEqual({ answered: true, status: 404, body: { match: null } });
  });

  it("hands back a body that is not JSON as no body at all, still as an answer", async () => {
    const fetchImpl: FetchLike = async () => new Response("<html>502</html>", { status: 502 });

    expect(await getPublicJson(URL, { fetchImpl, timeoutMs: 1_000 })).toEqual({ answered: true, status: 502, body: undefined });
  });

  it("says no answer came when the deadline passed before the response did", async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });

    expect(await getPublicJson(URL, { fetchImpl, timeoutMs: 5 })).toEqual({ answered: false, why: "timeout" });
  });

  /* The headers came in time and the body did not: that is the deadline too, not a malformed answer. */
  it("says the same when the deadline passed while the body was arriving", async () => {
    const fetchImpl: FetchLike = async (_url, init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"match":'));
            init.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
          },
        }),
        { status: 200 },
      );

    expect(await getPublicJson(URL, { fetchImpl, timeoutMs: 5 })).toEqual({ answered: false, why: "timeout" });
  });

  it("says no answer came when the request never completed", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError("getaddrinfo ENOTFOUND");
    };

    expect(await getPublicJson(URL, { fetchImpl, timeoutMs: 1_000 })).toEqual({ answered: false, why: "unreachable" });
  });
});
