import { getEmbedCopy } from "../i18n/embedCopy";
import type { Locale } from "../i18n/locales";
import { embedCardHtml, type EmbedCard } from "./embedCard";
import { MEASURED_DAYS, poolEmbedData, type PoolEmbedFigures } from "./poolEmbed";

/*
 * How the card and its JSON answer, in one place for both routes.
 *
 * Cached in front as well as here, for as long as the figures are kept: a
 * card is loaded by every reader of every page it sits on, and a cache in
 * front answers most of them without this server hearing of it. Each answer
 * is the same for everyone who asks with the same address — the language is
 * in the address, never in a cookie — which is what makes that safe.
 *
 * Kept less long when there is nothing to show, so a pool that was briefly
 * unreadable is not shown as unreadable for five minutes after it comes back;
 * and longer for an address that names no pool, which no later moment will
 * change.
 */

/**
 * How long a pool's figures are kept, here (readPoolEmbed.ts) and in front.
 * Five minutes, because they carry the current price — a share card, which
 * carries none, is kept a day.
 */
export const EMBED_TTL_SECONDS = 300;

export const FIGURES_CACHE = `public, max-age=${EMBED_TTL_SECONDS}, s-maxage=${EMBED_TTL_SECONDS}`;
export const UNREADABLE_CACHE = "public, max-age=60, s-maxage=60";
export const NOT_A_POOL_CACHE = "public, max-age=3600, s-maxage=3600";

export type EmbedAnswer =
  | { readonly kind: "pool"; readonly figures: PoolEmbedFigures }
  | { readonly kind: "unreadable"; readonly poolUrl: string }
  | { readonly kind: "not-a-pool" };

/* 400 for an address that names nothing, 503 for a pool that could not be read just now. */
const statusOf = (answer: EmbedAnswer): number =>
  answer.kind === "pool" ? 200 : answer.kind === "unreadable" ? 503 : 400;

const cacheOf = (answer: EmbedAnswer): string =>
  answer.kind === "pool" ? FIGURES_CACHE : answer.kind === "unreadable" ? UNREADABLE_CACHE : NOT_A_POOL_CACHE;

/** The card, as a whole page. Who may frame it is the proxy's to say (see security/responseHeaders.ts). */
export const embedCardResponse = (answer: EmbedAnswer, locale: Locale): Response => {
  const card: EmbedCard = answer;
  return new Response(embedCardHtml(card, locale), {
    status: statusOf(answer),
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cacheOf(answer) },
  });
};

/**
 * The same figures as JSON, readable from any site's own script: they are
 * public, the same for everyone, and carry no credential, so there is nothing
 * for another origin to read that it could not read by loading the card.
 *
 * A failure is JSON too, with a code a script can test and the disclaimer
 * every answer carries — never a page or a stack trace.
 */
export const embedDataResponse = (answer: EmbedAnswer, locale: Locale): Response => {
  const disclaimer = getEmbedCopy(locale).disclaimer(String(MEASURED_DAYS));
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": cacheOf(answer),
    "Content-Type": "application/json; charset=utf-8",
  };

  if (answer.kind === "pool") {
    const data = poolEmbedData(answer.figures, locale);
    if (data !== null) return new Response(JSON.stringify(data), { status: 200, headers });
    /* A shape that does not hold is not sent: it is answered as the pool it could not describe. */
    return new Response(JSON.stringify({ error: "unreadable", poolUrl: answer.figures.poolUrl, disclaimer }), {
      status: 503,
      headers: { ...headers, "Cache-Control": UNREADABLE_CACHE },
    });
  }

  const body =
    answer.kind === "unreadable"
      ? { error: "unreadable", poolUrl: answer.poolUrl, disclaimer }
      : { error: "not-a-pool", disclaimer };
  return new Response(JSON.stringify(body), { status: statusOf(answer), headers });
};
