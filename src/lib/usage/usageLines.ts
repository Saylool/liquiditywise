/*
 * The two lines this application writes about its own use, and the reader of
 * them — kept in one file so the format cannot drift between the side that
 * writes a line and the side that counts it.
 *
 *   [visit] page=/pool pool=v3:0x88e6… locale=tr bot=0 outcome=served
 *   [interpretation] spent model=gpt-5.6-luna in=1834 out=612 pool=v3:0x88e6… pair=USDC/WETH
 *
 * What a visit line leaves out is the point of it. No IP address, no browser
 * string, no search text, and never the address on /holdings: that one is a
 * reader's wallet, and the site tells them nothing is kept unless they ask for
 * alerts. A pool is a public contract and says nothing about who opened it.
 *
 * No runtime imports: deploy/usage-report.mts runs this under plain Node.
 */

export const PAGES = ["/", "/pool", "/v4", "/compare", "/holdings", "/hooks", "/learn"] as const;
export type Page = (typeof PAGES)[number];

export type Outcome = "served" | "refused";

export type Visit = {
  readonly page: Page;
  /** `v3:0x…` or `v4:0x…`, `search` for a query, or `null`. */
  readonly pool: string | null;
  readonly locale: string;
  readonly bot: boolean;
  readonly outcome: Outcome;
};

export type Spend = {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly pool: string;
  readonly pair: string;
};

const ADDRESS = /^0x[0-9a-f]{40}$/;
const POOL_ID = /^0x[0-9a-f]{64}$/;

/**
 * Crawlers, uptime checks and scripts, told apart from people by what they
 * call themselves. Counted on their own line rather than dropped: a week that
 * was all bots is worth knowing too.
 */
const BOT = /bot|crawl|spider|slurp|curl|wget|python|httpclient|http-client|headless|lighthouse|monitor|uptime|preview|facebookexternalhit|embedly|go-http|java\/|okhttp|axios|node-fetch|undici/i;

export const looksLikeBot = (userAgent: string | null): boolean =>
  userAgent === null || userAgent.trim() === "" || BOT.test(userAgent);

const isPage = (path: string): path is Page => (PAGES as readonly string[]).includes(path);

/**
 * The pool a page was opened for, when it names one. `/holdings` never does,
 * whatever its query says.
 */
const poolOf = (page: Page, parameters: URLSearchParams): string | null => {
  if (page === "/pool" || page === "/compare") {
    const address = parameters.get("address")?.trim().toLowerCase() ?? "";
    if (ADDRESS.test(address)) return `v3:${address}`;
  }
  if (page === "/v4") {
    const id = parameters.get("id")?.trim().toLowerCase() ?? "";
    if (POOL_ID.test(id)) return `v4:${id}`;
  }
  if ((page === "/pool" || page === "/v4") && parameters.get("q") !== null) return "search";
  return null;
};

/**
 * A visit, or `null` for a request that is not one: another path, or a browser
 * loading a page speculatively ahead of a click that may never come.
 *
 * The router's own prefetches cannot be told apart here — the framework strips
 * `next-router-prefetch` before the proxy sees a request — so none are made:
 * no link in the application prefetches, and linksNeverPrefetch.test.ts keeps
 * it that way. What does reach the proxy is the browser's own speculation,
 * which says so in `Purpose` or `Sec-Purpose`.
 */
export const visitFrom = (
  url: URL,
  headers: Headers,
  locale: string,
  outcome: Outcome,
): Visit | null => {
  if (!isPage(url.pathname)) return null;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch")) return null;

  return {
    page: url.pathname,
    pool: poolOf(url.pathname, url.searchParams),
    locale,
    bot: looksLikeBot(headers.get("user-agent")),
    outcome,
  };
};

export const visitLine = (visit: Visit): string =>
  `[visit] page=${visit.page} pool=${visit.pool ?? "-"} locale=${visit.locale} bot=${visit.bot ? 1 : 0} outcome=${visit.outcome}`;

/** A token symbol, reduced to what cannot break the line it sits in. */
const symbol = (value: string): string => value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 20) || "?";

export const spendLine = (spend: Spend): string =>
  `[interpretation] spent model=${spend.model.replace(/[^A-Za-z0-9._-]/g, "")} in=${spend.inputTokens} out=${spend.outputTokens} pool=${spend.pool} pair=${spend.pair
    .split("/")
    .map(symbol)
    .join("/")}`;

/** An explanation that was not written because the hourly ceiling had been reached. */
export const cappedLine = (pool: string): string => `[interpretation] capped pool=${pool}`;

export type UsageLine =
  | { readonly kind: "visit"; readonly at: string | null; readonly visit: Visit }
  | { readonly kind: "spend"; readonly at: string | null; readonly spend: Spend }
  | { readonly kind: "rejected"; readonly at: string | null }
  | { readonly kind: "capped"; readonly at: string | null };

const fields = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split(" ")
      .map((part) => part.split("="))
      .filter((pair): pair is [string, string] => pair.length === 2 && pair[0] !== "" && pair[1] !== ""),
  );

const count = (value: string | undefined): number | null =>
  value !== undefined && /^\d{1,9}$/.test(value) ? Number(value) : null;

/**
 * One journal line, as `journalctl -o short-iso` prints it, or `null` for any
 * line that is not one of ours. The time is the journal's, when it has one.
 */
export const parseUsageLine = (line: string): UsageLine | null => {
  const at = /^(\d{4}-\d{2}-\d{2})T/.exec(line)?.[1] ?? null;

  const visit = /\[visit\] (.*)$/.exec(line)?.[1];
  if (visit !== undefined) {
    const f = fields(visit);
    const page = f.page ?? "";
    if (!isPage(page)) return null;
    const outcome = f.outcome === "refused" ? "refused" : f.outcome === "served" ? "served" : null;
    if (outcome === null || (f.bot !== "0" && f.bot !== "1") || f.locale === undefined) return null;
    const pool = f.pool === undefined || f.pool === "-" ? null : f.pool;
    return { kind: "visit", at, visit: { page, pool, locale: f.locale, bot: f.bot === "1", outcome } };
  }

  const spent = /\[interpretation\] spent (.*)$/.exec(line)?.[1];
  if (spent !== undefined) {
    const f = fields(spent);
    const inputTokens = count(f.in);
    const outputTokens = count(f.out);
    if (f.model === undefined || inputTokens === null || outputTokens === null) return null;
    return {
      kind: "spend",
      at,
      spend: { model: f.model, inputTokens, outputTokens, pool: f.pool ?? "-", pair: f.pair ?? "?" },
    };
  }

  if (line.includes("[interpretation] answer rejected")) return { kind: "rejected", at };
  if (line.includes("[interpretation] capped")) return { kind: "capped", at };
  return null;
};
