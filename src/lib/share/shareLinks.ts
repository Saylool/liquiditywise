import { CHAIN_PARAMETER } from "../advisor/requestedParameters";
import { type Chain, ETHEREUM } from "../chains/chains";
import type { Locale } from "../i18n/locales";
import { SHARE_PAGES, SITE_URL } from "../site/indexing";

/*
 * The three addresses the share row under a record offers: the card as an
 * image, the post on X that carries it, and the holdings page the record was
 * read on. The shape is shareRequest.ts's: the chain unsaid on mainnet, and
 * the language only when it is not English — so the card a reader links is
 * the one they were looking at, and a card linked before another language
 * existed still reads the same.
 *
 * Absolute, on the site's own host: a shared link leaves this site, and a
 * relative one would point into whatever page it was pasted on.
 *
 * Pure: strings from strings.
 */

const [CARD_PATH] = SHARE_PAGES;

export const SHARE_CARD_PATH = CARD_PATH;

/** Where X opens a prewritten post. The reader still has to send it. */
export const X_INTENT = "https://x.com/intent/post";

const chainQuery = (chain: Chain): Record<string, string> => (chain.id === ETHEREUM.id ? {} : { [CHAIN_PARAMETER]: chain.slug });

/** The card as an image, in the given language. */
export const shareCardUrl = (chain: Chain, tokenId: string, locale: Locale): string =>
  `${SITE_URL}${CARD_PATH}?${new URLSearchParams({
    ...chainQuery(chain),
    id: tokenId,
    ...(locale === "en" ? {} : { lang: locale }),
  }).toString()}`;

/**
 * The holdings page an address's positions are read on — the "copy link" of
 * the share row. The address is public: a position's owner is on chain, and
 * this is the page that says so.
 */
export const holdingsUrl = (address: string, chain: Chain): string =>
  `${SITE_URL}/holdings?${new URLSearchParams({ ...chainQuery(chain), address }).toString()}`;

/** A post on X with the text written and the card's address attached; X shows both for the reader to send or change. */
export const postOnXUrl = (text: string, url: string): string => `${X_INTENT}?${new URLSearchParams({ text, url }).toString()}`;
