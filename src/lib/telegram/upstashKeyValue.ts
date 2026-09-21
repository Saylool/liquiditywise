import { z } from "zod";

import type { KeyValueStore } from "../store/keyValueStore";

/*
 * A handful of Redis commands over Upstash's REST API, for the Telegram links.
 *
 * The same transport as the rate limit's counter, and the same rules: no
 * dependency, an injected `fetch`, a short timeout, and `null` for every
 * failure — a refused token, an unreachable host, a slow answer, a body in a
 * shape this does not recognise. The caller cannot act differently on any of
 * them, and what it must never get is a thrown error.
 *
 * Anything that speaks the Upstash REST protocol will do: Upstash itself on
 * Vercel, or a Redis at home behind a small REST shim.
 */

export const DEFAULT_KEY_VALUE_TIMEOUT_MS = 2_000;

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;


const ResultSchema = z.object({ result: z.unknown() });

export type UpstashKeyValueOptions = {
  readonly url: string;
  readonly token: string;
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
};

/**
 * Builds a store over one Upstash database.
 *
 * `get` answers `undefined` when the store could not be asked and `null` when
 * it answered that there is no such key: a link that cannot be looked up is
 * not a link that does not exist, and the webhook must not tell someone their
 * token is invalid because the database was slow.
 */
export const createUpstashKeyValueStore = ({
  url,
  token,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_KEY_VALUE_TIMEOUT_MS,
}: UpstashKeyValueOptions): KeyValueStore => {
  const command = async (args: readonly string[]): Promise<unknown | undefined> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(url.replace(/\/+$/, ""), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
        body: JSON.stringify(args),
        signal: controller.signal,
      });
      if (!response.ok) return undefined;

      const parsed = ResultSchema.safeParse(await response.json());
      return parsed.success ? parsed.data.result : undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    get: async (key) => {
      const result = await command(["GET", key]);
      if (result === undefined) return undefined;
      return typeof result === "string" ? result : null;
    },
    set: async (key, value, ttlMs) => {
      const args = ttlMs === undefined ? ["SET", key, value] : ["SET", key, value, "PX", String(ttlMs)];
      return (await command(args)) === "OK";
    },
    del: async (key) => typeof (await command(["DEL", key])) === "number",
    sadd: async (key, member) => typeof (await command(["SADD", key, member])) === "number",
    srem: async (key, member) => typeof (await command(["SREM", key, member])) === "number",
    smembers: async (key) => {
      const result = await command(["SMEMBERS", key]);
      return Array.isArray(result) && result.every((item) => typeof item === "string")
        ? result
        : null;
    },
  };
};
