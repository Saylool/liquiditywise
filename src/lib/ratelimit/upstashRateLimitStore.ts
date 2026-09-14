import { z } from "zod";

import type { RateLimitStore } from "./rateLimitStore";

/*
 * The shared counter, over Upstash's REST API.
 *
 * REST rather than a Redis client, and no dependency at all: the API is an HTTPS
 * POST with a bearer token, which is the same shape as every other outbound call
 * here and testable the same way — with an injected `fetch` and no server.
 *
 * It speaks two commands. `INCR` creates the key at 1 or adds to it and returns
 * the total. `PEXPIRE … NX` puts a lifetime on it *only if it has none*, so the
 * first request of a window sets the clock and the rest leave it alone; without
 * `NX` every request would push the expiry out and a busy window would never
 * end.
 *
 * Both travel in one pipelined request, so a counted request costs one round
 * trip rather than two. The response is an array in the same order.
 */

/** Whole seconds of patience. The proxy is in front of a page render. */
export const DEFAULT_STORE_TIMEOUT_MS = 1_000;

/** The subset of `fetch` this module uses, matching the other transports here. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Upstash answers a pipeline with one object per command. Only the first is
 * read: `PEXPIRE` returning 0 means the key already had a lifetime, which is the
 * expected answer for every request after the first and not a problem.
 *
 * Non-strict, like every other wire schema here: a provider adding a field must
 * not break a read.
 */
const PipelineResponseSchema = z.array(z.object({ result: z.unknown() })).min(1);

export type UpstashStoreOptions = {
  /** The REST endpoint, e.g. `https://….upstash.io`. A credential in its own right. */
  readonly url: string;
  readonly token: string;
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
};

/**
 * Builds a store backed by one Upstash database.
 *
 * Every failure — a refused token, an unreachable host, a slow answer, a
 * response in a shape this does not recognise — comes back as `null`, the same
 * as every other. The caller cannot act differently on any of them: it has a
 * page to render either way, and the local limiter is still counting. What it
 * must never get is a thrown error, so nothing here can throw.
 */
export const createUpstashRateLimitStore = ({
  url,
  token,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_STORE_TIMEOUT_MS,
}: UpstashStoreOptions): RateLimitStore => ({
  increment: async (key, ttlMs) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(`${url.replace(/\/+$/, "")}/pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, String(ttlMs), "NX"],
        ]),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const parsed = PipelineResponseSchema.safeParse(await response.json());
      if (!parsed.success) return null;

      /*
       * `INCR` answers with a JSON number. Anything else — a string, a null, an
       * error object — means this is not the counter it was asked for, and a
       * count that cannot be trusted is the same as no count.
       */
      const count = parsed.data[0]?.result;
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1) return null;

      return count;
    } catch {
      // An abort, a DNS failure, a body that is not JSON. None is actionable.
      return null;
    } finally {
      clearTimeout(timeout);
    }
  },
});
