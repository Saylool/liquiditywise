import { EMBED_TTL_SECONDS, NOT_A_POOL_TTL_SECONDS, UNREADABLE_TTL_SECONDS } from "../embed/embedResponses";

/*
 * How the share card answers when it has no card to draw, and how long each
 * answer may be kept — in one place, so the route, the developers page and
 * the tests that hold them together read the same constants.
 *
 * Kept like the embeddable card's answers (embed/embedResponses.ts), for the
 * same reason: a card is loaded by everyone the link reaches, and a cache in
 * front answers most of them. Each answer is the same for everyone who asks
 * with the same address — the language is in the address, never in a cookie.
 *
 * A failure is JSON, with a code a script can test, like the embed API's:
 * never a page, never a stack trace, and never a card with a figure on it.
 */

/** How long a drawn card is kept, here and in front: the embed card's five minutes, since a record carries today's price. */
export const SHARE_TTL_SECONDS = EMBED_TTL_SECONDS;

/** An address that names no position: an hour, since no later moment will change it. */
export const NOT_A_POSITION_TTL_SECONDS = NOT_A_POOL_TTL_SECONDS;

/**
 * An id under which the manager holds no open position: as long as a card,
 * not an hour — an id not minted yet may be minted, and one just closed is
 * simply gone.
 */
export const NO_SUCH_POSITION_TTL_SECONDS = EMBED_TTL_SECONDS;

/** A position that could not be read: a minute, so one that comes back is not shown as unreadable for long. */
export const SHARE_UNREADABLE_TTL_SECONDS = UNREADABLE_TTL_SECONDS;

const keptFor = (seconds: number): string => `public, max-age=${seconds}, s-maxage=${seconds}`;

export const SHARE_CARD_CACHE = keptFor(SHARE_TTL_SECONDS);
export const NOT_A_POSITION_CACHE = keptFor(NOT_A_POSITION_TTL_SECONDS);
export const NO_SUCH_POSITION_CACHE = keptFor(NO_SUCH_POSITION_TTL_SECONDS);
export const SHARE_UNREADABLE_CACHE = keptFor(SHARE_UNREADABLE_TTL_SECONDS);

/** Why there is no card: the address names no position, the chain holds none under that id, or it could not be read just now. */
export type ShareFailure = "not-a-position" | "no-such-position" | "unreadable";

/* 400 for an address that names nothing, 404 for an id the chain has no open position under, 503 for one that could not be read. */
export const shareFailureStatus = (failure: ShareFailure): number =>
  failure === "not-a-position" ? 400 : failure === "no-such-position" ? 404 : 503;

export const shareFailureCache = (failure: ShareFailure): string =>
  failure === "not-a-position" ? NOT_A_POSITION_CACHE : failure === "no-such-position" ? NO_SUCH_POSITION_CACHE : SHARE_UNREADABLE_CACHE;

/** The failure as JSON: the code, and nothing of what went wrong inside. */
export const shareFailureResponse = (failure: ShareFailure): Response =>
  new Response(JSON.stringify({ error: failure }), {
    status: shareFailureStatus(failure),
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": shareFailureCache(failure) },
  });
