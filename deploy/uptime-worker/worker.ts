/*
 * The check that still runs when the server does not.
 *
 * A Cloudflare Worker on a five-minute schedule. It asks every site the
 * server hosts from Cloudflare's own machines, remembers the answers in
 * Workers KV, and tells the operator through the same Telegram bot when they
 * stop being reachable and when they come back — and whether it is one site
 * or the whole server. Every judgement is in `src/lib/health/uptime.ts`,
 * where it is tested; this file only carries the answers there and the
 * verdict back.
 *
 * It has no fetch handler on purpose. A public URL that sends a Telegram
 * message is a URL anyone can make send one; a scheduled Worker has no URL,
 * and it is triggered for testing from the Cloudflare dashboard instead.
 */

import { decideFleet, readFleetMemory, readSites } from "../../src/lib/health/uptime";

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
  /**
   * The sites to ask, as JSON: `[{ "name": "...", "url": "https://..." }]`.
   * liquiditywise is asked at its health route, which a live app answers with
   * 401 and which is never cached; the others at their home pages.
   */
  readonly SITES: string;
  /** Secrets, set in the dashboard or with `wrangler secret put`, never in this file. */
  readonly TELEGRAM_BOT_TOKEN: string;
  readonly TELEGRAM_OPERATOR_CHAT_ID: string;
};

const MEMORY_KEY = "fleet";

/** Ten seconds. A site that takes longer has answered the question. */
const TIMEOUT_MS = 10_000;

/**
 * The status a site answered with, or `null` for no answer at all.
 *
 * Uncached and cache-busted both: Cloudflare's Always Online can serve a
 * stored copy of a page while the origin is down, which is precisely the
 * moment this must not be fooled — and a query no cache has seen has no
 * stored copy to serve.
 */
const ask = async (url: string, fetchImpl: Fetch): Promise<number | null> => {
  const separator = url.includes("?") ? "&" : "?";
  try {
    const response = await fetchImpl(`${url}${separator}uptime=${Date.now()}`, {
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
  const sites = readSites(env.SITES);

  /*
   * All at once, so a server that has gone down is seen going down by every
   * site in the same run — which is what lets the verdict name the server
   * rather than report three sites one after another.
   */
  const answers = await Promise.all(sites.map(async (site) => [site.name, await ask(site.url, fetchImpl)] as const));
  const previous = readFleetMemory(await env.UPTIME.get(MEMORY_KEY));
  const decision = decideFleet(sites, previous, Object.fromEntries(answers));

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
