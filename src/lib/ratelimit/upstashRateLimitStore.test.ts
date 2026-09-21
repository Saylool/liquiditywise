import { describe, expect, it, vi } from "vitest";

import { createUpstashRateLimitStore, type FetchLike } from "./upstashRateLimitStore";

const URL_BASE = "https://example-db.upstash.io";
const TOKEN = "upstash-token-must-never-leak";
const KEY = "liquiditywise:ratelimit:203.0.113.7:60000";
const TTL_MS = 120_000;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const counted = (count: number) => [{ result: count }, { result: 1 }];

const store = (
  fetchImpl: FetchLike,
  overrides: { url?: string; timeoutMs?: number } = {},
) =>
  createUpstashRateLimitStore({
    url: overrides.url ?? URL_BASE,
    token: TOKEN,
    fetchImpl,
    ...(overrides.timeoutMs === undefined ? {} : { timeoutMs: overrides.timeoutMs }),
  });

const captureRequest = async () => {
  const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(counted(3)));
  const result = await store(fetchImpl).increment(KEY, TTL_MS);

  const call = fetchImpl.mock.calls[0];
  if (call === undefined) throw new Error("fetch was not called");
  const [url, init] = call;

  return {
    result,
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(String(init.body)) as unknown[][],
  };
};

describe("createUpstashRateLimitStore", () => {
  it("returns the running total for the window", async () => {
    const { result } = await captureRequest();

    expect(result).toBe(3);
  });

  /*
   * Both commands in one request, so a counted request costs one round trip in
   * front of a page render rather than two.
   */
  it("counts and sets the lifetime in a single pipelined request", async () => {
    const { url, body } = await captureRequest();

    expect(url).toBe(`${URL_BASE}/pipeline`);
    expect(body).toEqual([
      ["INCR", KEY],
      ["PEXPIRE", KEY, String(TTL_MS), "NX"],
    ]);
  });

  /*
   * Without `NX`, every request would push the expiry out and a busy window
   * would never end.
   */
  it("sets the lifetime only if the key does not already have one", async () => {
    const { body } = await captureRequest();

    expect(body[1]?.at(-1)).toBe("NX");
  });

  it("sends the token in the header and never in the URL", async () => {
    const { url, headers } = await captureRequest();

    expect(url).not.toContain(TOKEN);
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("does not double the slash when the endpoint is configured with one", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(counted(1)));

    await store(fetchImpl, { url: `${URL_BASE}/` }).increment(KEY, TTL_MS);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${URL_BASE}/pipeline`);
  });

  it("never lets a shared cache answer for the counter", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(counted(1)));

    await store(fetchImpl).increment(KEY, TTL_MS);

    expect(fetchImpl.mock.calls[0]?.[1].cache).toBe("no-store");
  });

  /*
   * Every failure comes back the same way, because the caller cannot act
   * differently on any of them: it has a page to render, and the local limiter
   * is still counting.
   */
  it.each([
    ["a refused token", jsonResponse({ error: "unauthorized" }, 401)],
    ["a server error", jsonResponse({}, 500)],
    ["a body that is not JSON", new Response("nope", { status: 200 })],
    ["a response that is not a pipeline", jsonResponse({ result: 1 })],
    ["an empty pipeline", jsonResponse([])],
    ["a count that is not a number", jsonResponse([{ result: "3" }, { result: 1 }])],
    ["a count that is not whole", jsonResponse([{ result: 1.5 }, { result: 1 }])],
    ["a count below one", jsonResponse([{ result: 0 }, { result: 1 }])],
    ["an error where the count belongs", jsonResponse([{ result: null }, { result: 1 }])],
  ])("answers nothing for %s", async (_label, response) => {
    const fetchImpl = vi.fn<FetchLike>(async () => response);

    expect(await store(fetchImpl).increment(KEY, TTL_MS)).toBeNull();
  });

  it("answers nothing when the request never connects", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new TypeError("fetch failed");
    });

    expect(await store(fetchImpl).increment(KEY, TTL_MS)).toBeNull();
  });

  /*
   * The proxy is in front of a page render, so a slow store has to become a
   * missing answer rather than a slow page.
   */
  it("gives up rather than holding a page open", async () => {
    const fetchImpl = vi.fn<FetchLike>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    expect(await store(fetchImpl, { timeoutMs: 10 }).increment(KEY, TTL_MS)).toBeNull();
  });

  it("never throws, whatever comes back", async () => {
    const throwing = vi.fn<FetchLike>(() => {
      throw new Error("synchronously, even");
    });

    await expect(store(throwing).increment(KEY, TTL_MS)).resolves.toBeNull();
  });
});
