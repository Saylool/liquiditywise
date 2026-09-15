import { NextResponse, type NextRequest } from "next/server";

import { getDictionary } from "./lib/i18n/dictionaries";
import { LOCALE_COOKIE, type Locale, resolveLocale } from "./lib/i18n/locales";
import { spendsUpstreamQuota } from "./lib/ratelimit/chargeableRequest";
import { clientKeyFromHeaders } from "./lib/ratelimit/clientKey";
import { checkSharedPoolAnalysisLimit } from "./lib/ratelimit/poolAnalysisSharedLimiter";
import {
  POOL_ANALYSIS_REQUEST_LIMIT,
  poolAnalysisRateLimiter,
} from "./lib/ratelimit/poolAnalysisRateLimiter";

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
export const config = {
  matcher: ["/pool", "/holdings", "/v4"],
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

const refuse = (request: NextRequest, retryAfterSeconds: number): NextResponse => {
  const locale = resolveLocale({
    cookieValue: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });

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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!spendsUpstreamQuota(request.nextUrl.searchParams)) return NextResponse.next();

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
  if (!local.allowed) return refuse(request, local.retryAfterSeconds);

  /*
   * `null` from the shared counter means either that there is none or that the
   * one there is could not answer. Both leave this request governed by the local
   * limiter alone, which is the limit this application enforced before a shared
   * store was possible — a degradation, not an opening.
   */
  const shared = await checkSharedPoolAnalysisLimit({ clientKey });
  if (shared !== null && !shared.allowed) return refuse(request, shared.retryAfterSeconds);

  return NextResponse.next();
}
