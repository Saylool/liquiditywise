/*
 * The check that still runs when the server does not.
 *
 * A Cloudflare Worker on a five-minute schedule. It asks the site's health
 * route from Cloudflare's own machines, remembers the answer in Workers KV,
 * and tells the operator through the same Telegram bot when the site stops
 * being reachable and when it comes back. Every judgement is in
 * `src/lib/health/uptime.ts`, where it is tested; this file only carries the
 * answer there and the verdict back.
 *
 * It has no fetch handler on purpose. A public URL that sends a Telegram
 * message is a URL anyone can make send one; a scheduled Worker has no URL,
 * and it is triggered for testing from the Cloudflare dashboard instead.
 */

import { decideUptime, readUptimeMemory } from "../../src/lib/health/uptime";

/*
 * The small part of the Workers runtime this uses, declared here rather than
 * pulled in as a package: the application's type check covers this file, and
 * a dependency for three signatures would be a dependency for nothing.
 */
type KvNamespace = {
  readonly get: (key: string) => Promise<string | null>;
  readonly put: (key: string, value: string) => Promise<void>;
};

type ExecutionContext = { readonly waitUntil: (promise: Promise<unknown>) => void };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type Env = {
  readonly UPTIME: KvNamespace;
  /** Where to ask. The health route, unauthenticated: a live app answers 401. */
  readonly TARGET: string;
  /** Secrets, set in the dashboard or with `wrangler secret put`, never in this file. */
  readonly TELEGRAM_BOT_TOKEN: string;
  readonly TELEGRAM_OPERATOR_CHAT_ID: string;
};

const MEMORY_KEY = "memory";

/** Ten seconds. A site that takes longer has answered the question. */
const TIMEOUT_MS = 10_000;

/**
 * The status the site answered with, or `null` for no answer at all.
 *
 * Uncached and cache-busted both: Cloudflare can serve a stored copy of a page
 * while the origin is down, which is precisely the moment this must not be
 * fooled. The health route is never cached, and the query makes certain.
 */
const ask = async (target: string, fetchImpl: Fetch): Promise<number | null> => {
  try {
    const response = await fetchImpl(`${target}?uptime=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.status;
  } catch {
    return null;
  }
};

/**
 * Throws unless Telegram accepted the message. `fetch` resolves on a 500 as
 * readily as on a 200, and a failure it does not report is a message nobody
 * knows was lost.
 */
const tell = async (env: Env, text: string, fetchImpl: Fetch): Promise<void> => {
  const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_OPERATOR_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(`Telegram answered ${response.status}`);
};

/** One run. Takes `fetch` so the order of what it does can be tested. */
export const check = async (env: Env, fetchImpl: Fetch = fetch): Promise<void> => {
  const status = await ask(env.TARGET, fetchImpl);
  const previous = readUptimeMemory(await env.UPTIME.get(MEMORY_KEY));
  const decision = decideUptime(previous, status);

  /*
   * Sent first, written second — the same order as the server's own check,
   * and for the same reason. If the message fails, nothing is recorded, so
   * the next run reaches the same verdict and tries again: a message sent
   * twice is better than one swallowed. Written the other way round, a
   * Telegram outage at the wrong moment would leave "down" stored and
   * nobody told.
   *
   * Only written when it changed: an ordinary day writes nothing at all.
   */
  if (decision.message !== null) await tell(env, decision.message, fetchImpl);
  if (decision.changed) await env.UPTIME.put(MEMORY_KEY, JSON.stringify(decision.memory));
};

const worker = {
  scheduled(_controller: unknown, env: Env, context: ExecutionContext): void {
    context.waitUntil(check(env));
  },
};

export default worker;
