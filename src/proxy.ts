import { NextResponse, type NextRequest } from "next/server";

import { getDictionary } from "./lib/i18n/dictionaries";
import { LOCALE_HEADER, PATH_HEADER, splitLocalePath } from "./lib/i18n/localePath";
import { LOCALE_COOKIE, localeCookie, type Locale, resolveLocale } from "./lib/i18n/locales";
import { spendsUpstreamQuota } from "./lib/ratelimit/chargeableRequest";
import { clientKeyFromHeaders } from "./lib/ratelimit/clientKey";
import { logUsage } from "./lib/observability/serverDiagnostics";
import { checkSharedPoolAnalysisLimit } from "./lib/ratelimit/poolAnalysisSharedLimiter";
import {
  POOL_ANALYSIS_REQUEST_LIMIT,
  poolAnalysisRateLimiter,
} from "./lib/ratelimit/poolAnalysisRateLimiter";
import { visitFrom, visitLine, type Outcome } from "./lib/usage/usageLines";

/*
 * Rate limits the one route that spends third-party API quota.
 *
 * Here rather than inside the page because a refused request should cost as
 * little as possible: Proxy runs before rendering begins, and it can answer with
 * a real `429` and a `Retry-After` header, which a Server Component has no way
 * to set.
 *
 * Which requests are charged is next door in `chargeableRequest.ts`, which has
 * no framework in it and can be tested on its own. What is left here is the
 * plumbing: read the count, and answer.
 *
 * Two limits worth stating plainly:
 *
 *   - The local count lives in one process's memory, so a platform running
 *     several instances multiplies it by however many are warm. A shared counter
 *     closes that when one is configured; with none, this is a deterrent against
 *     casual abuse rather than a hard ceiling.
 *   - It identifies a caller by proxy-set headers, so it is only as trustworthy
 *     as the hop in front of it. See `clientKey.ts`.
 */

/*
 * Both routes that reach a source. The rule for what actually counts is next
 * door and is the same for both: a valid address is a request that will spend
 * something upstream, whichever page it was asked of.
 *
 * A holdings lookup is the more expensive of the two — a pool list and then
 * seven batches of contract calls — so leaving it outside this would have made
 * the cheaper page the guarded one.
 */
/*
 * Every page, not only the two that spend quota: this is also where a visit is
 * counted for the weekly report, and a page is counted here once, before it
 * renders, however it was reached. Held to usageLines.ts's list by a test.
 *
 * And every open page's language addresses, which exist only because this
 * turns them into the page itself (see localePath.ts). Written out rather than
 * built from LOCALES because Next reads this object without running the file;
 * a test holds the two to each other.
 */
export const config = {
  matcher: [
    "/",
    "/pool",
    "/v4",
    "/compare",
    "/holdings",
    "/hooks",
    "/learn",
    "/:locale(en|tr|de|es|ar|hi|zh|ru|pt|zh-Hant)",
    "/:locale(en|tr|de|es|ar|hi|zh|ru|pt|zh-Hant)/hooks",
    "/:locale(en|tr|de|es|ar|hi|zh|ru|pt|zh-Hant)/learn",
  ],
};

/**
 * A page for the refused request.
 *
 * Deliberately self-contained rather than reusing the application's layout: at
 * this point the goal is to spend nothing, and rendering the real page is the
 * cost being avoided. Only a number reaches the markup.
 *
 * It still speaks the reader's language, because being turned away is exactly
 * the moment an explanation has to land.
 */
const tooManyRequestsPage = (retryAfterSeconds: number, locale: Locale): string => `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${getDictionary(locale).rateLimited.title}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0; padding: 1.5rem; min-height: 100vh;
        display: grid; place-items: center;
        font: 16px/1.6 ui-sans-serif, system-ui, sans-serif;
      }
      main { max-width: 34rem; }
      h1 { font-size: 1.5rem; margin: 0 0 1rem; }
      p { margin: 0 0 1rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>${getDictionary(locale).rateLimited.title}</h1>
      <p>${getDictionary(locale).rateLimited.body(POOL_ANALYSIS_REQUEST_LIMIT)}</p>
      <p>${getDictionary(locale).rateLimited.retry(retryAfterSeconds)}</p>
      <p><a href="/">${getDictionary(locale).rateLimited.back}</a></p>
    </main>
  </body>
</html>
`;

/** What the reader's cookie and browser ask for, ignoring any language in the address. */
const askedFor = (request: NextRequest): Locale =>
  resolveLocale({
    cookieValue: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });

const refuse = (retryAfterSeconds: number, locale: Locale): NextResponse => {
  return new NextResponse(tooManyRequestsPage(retryAfterSeconds, locale), {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSeconds),
      "Content-Type": "text/html; charset=utf-8",
      // Never let a shared cache serve one visitor's refusal to another.
      "Cache-Control": "no-store",
    },
  });
};

/**
 * The page a request is for, the language to render it in, and how to hand it
 * on.
 *
 * An address with a language in it goes on with the language in a request
 * header the page reads; next.config's rewrites then serve it as the page
 * without one (see localePath.ts for why not a rewrite here). The headers are
 * cleared first on every request, so a header sent from outside cannot choose
 * a language or pose as a language address.
 *
 * Arriving by a language address also writes that language into the cookie
 * when it differs from what the reader would otherwise get: someone who found
 * the Turkish page from a search and then looks up a pool should get the pool
 * in Turkish, and the pool pages only have the cookie to go on.
 */
const route = (request: NextRequest) => {
  const addressed = splitLocalePath(request.nextUrl.pathname);
  const headers = new Headers(request.headers);
  headers.delete(LOCALE_HEADER);
  headers.delete(PATH_HEADER);

  if (addressed === null) {
    return {
      page: request.nextUrl,
      locale: askedFor(request),
      pass: () => NextResponse.next({ request: { headers } }),
    };
  }

  headers.set(LOCALE_HEADER, addressed.locale);
  headers.set(PATH_HEADER, addressed.path);
  const page = request.nextUrl.clone();
  page.pathname = addressed.path;

  return {
    page,
    locale: addressed.locale,
    pass: () => {
      const response = NextResponse.next({ request: { headers } });
      if (askedFor(request) !== addressed.locale) {
        response.cookies.set(localeCookie(addressed.locale, process.env.NODE_ENV === "production"));
      }
      return response;
    },
  };
};

/** One line for the weekly report: which page, which pool, which language — never who. */
const recordVisit = (
  request: NextRequest,
  routed: { readonly page: URL; readonly locale: Locale },
  outcome: Outcome,
): void => {
  const visit = visitFrom(routed.page, request.headers, routed.locale, outcome);
  if (visit !== null) logUsage(visitLine(visit));
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const routed = route(request);

  if (!spendsUpstreamQuota(routed.page.searchParams)) {
    recordVisit(request, routed, "served");
    return routed.pass();
  }

  const clientKey = clientKeyFromHeaders(request.headers);

  /*
   * The local count first, and on its own when nothing shared is configured —
   * which is the default, and costs nothing: `checkSharedPoolAnalysisLimit`
   * decides there is no store before it awaits anything.
   *
   * A request refused here never reaches the store. It has already been refused,
   * and spending a network round trip to agree is a round trip in front of a
   * page render.
   */
  const local = poolAnalysisRateLimiter.check(clientKey);
  if (!local.allowed) {
    recordVisit(request, routed, "refused");
    return refuse(local.retryAfterSeconds, routed.locale);
  }

  /*
   * `null` from the shared counter means either that there is none or that the
   * one there is could not answer. Both leave this request governed by the local
   * limiter alone, which is the limit this application enforced before a shared
   * store was possible — a degradation, not an opening.
   */
  const shared = await checkSharedPoolAnalysisLimit({ clientKey });
  if (shared !== null && !shared.allowed) {
    recordVisit(request, routed, "refused");
    return refuse(shared.retryAfterSeconds, routed.locale);
  }

  recordVisit(request, routed, "served");
  return routed.pass();
}
