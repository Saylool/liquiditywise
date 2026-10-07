import { NextResponse, type NextRequest } from "next/server";

import { emailDigestSetup } from "@/lib/email/environment";
import { verifyToken } from "@/lib/email/signedToken";
import { readSubscription, unsubscribe } from "@/lib/email/subscriptions";
import { unsubscribePage, type UnsubscribeView } from "@/lib/email/unsubscribePage";
import { LOCALE_COOKIE, type Locale, resolveLocale } from "@/lib/i18n/locales";

/*
 * Where the link at the foot of every digest leads, and where a mail client's
 * own unsubscribe button posts.
 *
 * A handler rather than a page, because it has to answer POST: the one-click
 * unsubscribe the digest's headers offer (RFC 8058) is a POST to this very
 * address, and so is the button on the page a GET shows. Opening the link
 * changes nothing (email/unsubscribePage.ts says why); the POST deletes the
 * record at once, and the id comes out of the set the Monday pass walks
 * before the record itself goes, so nothing can be sent in between.
 *
 * The page speaks the language the reader subscribed in, which the record
 * remembers, read before anything is deleted; once it is gone — a link
 * clicked twice — the browser's language is all there is to go on. The token
 * proves itself, so a link that was not made here costs the store nothing.
 */

export const dynamic = "force-dynamic";

const HTML = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

/** The browser's own language, for a page with no record to ask. */
const browserLocale = (request: NextRequest): Locale =>
  resolveLocale({ cookieValue: request.cookies.get(LOCALE_COOKIE)?.value, acceptLanguage: request.headers.get("accept-language") });

const answer = (locale: Locale, view: UnsubscribeView, request: NextRequest, status = 200): NextResponse =>
  new NextResponse(unsubscribePage(locale, view, `${request.nextUrl.pathname}${request.nextUrl.search}`), { status, headers: HTML });

const handle = async (request: NextRequest, act: boolean): Promise<NextResponse> => {
  const setup = emailDigestSetup();
  if (setup === null) return new NextResponse("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const claims = verifyToken(setup.secret, request.nextUrl.searchParams.get("token"), "unsubscribe", new Date());
  if (claims === null) return answer(browserLocale(request), "invalid", request, 400);

  /* The record's language, while there is a record. */
  const existing = await readSubscription(setup.store, claims.id);
  const locale = existing === null || existing === undefined ? browserLocale(request) : existing.locale;

  if (!act) return answer(locale, "ask", request);

  const outcome = await unsubscribe(setup.store, claims.id);
  return answer(locale, outcome, request, outcome === "unavailable" ? 503 : 200);
};

export const GET = (request: NextRequest): Promise<NextResponse> => handle(request, false);
export const POST = (request: NextRequest): Promise<NextResponse> => handle(request, true);
