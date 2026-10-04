import { ETHEREUM } from "../chains/chains";
import { getEmbedCopy } from "../i18n/embedCopy";
import type { Locale } from "../i18n/locales";
import { EMBED_PAGES, SITE_URL } from "../site/indexing";
import { escapeHtml } from "./embedCard";
import type { EmbedRequest } from "./embedRequest";

/*
 * The addresses of one pool's card and its JSON, and the snippet the pool
 * page offers for pasting. The shape is embedRequest.ts's: the chain unsaid on
 * mainnet, `address` for a v3 pool and `id` for a v4 one, and the language
 * only when it is not English.
 */

const [CARD_PATH, DATA_PATH] = EMBED_PAGES;

const query = (request: EmbedRequest, locale: Locale | null): string =>
  new URLSearchParams({
    ...(request.chain.id === ETHEREUM.id ? {} : { chain: request.chain.slug }),
    [request.protocol === "v3" ? "address" : "id"]: request.poolId,
    ...(locale === null || locale === "en" ? {} : { lang: locale }),
  }).toString();

export const embedCardUrl = (request: EmbedRequest, locale: Locale): string => `${SITE_URL}${CARD_PATH}?${query(request, locale)}`;

/** The JSON's disclaimer follows `lang` too, but the figures do not, so the offered address leaves it out. */
export const embedDataUrl = (request: EmbedRequest): string => `${SITE_URL}${DATA_PATH}?${query(request, null)}`;

/**
 * How tall the frame is offered at: the card's size, and a little more when
 * it carries the hook note, so nothing on it is cut off at the bottom of
 * somebody else's page.
 *
 * With room for the one line the frame cannot be sized for in advance: the
 * note that the price is outside the range, which comes and goes after the
 * snippet is pasted. Measured on 2026-10-04 at 360 px wide with that note
 * forced in, USDC/WETH's card stood 163–198 px across the ten languages
 * (Turkish the tallest) and 189–225 px with the hook note too — 198 of 200
 * left no room for a pair or a network name one line longer. The footer
 * keeps to the bottom (`margin-top: auto`), so the room reads as space.
 */
export const EMBED_FRAME_WIDTH = 360;
export const embedFrameHeight = (hookMayAlterSwaps: boolean): number => (hookMayAlterSwaps ? 260 : 220);

/**
 * The frame to paste. Escaped like the card, because the title carries two
 * token symbols — whatever their contracts say — into someone else's markup.
 * As wide as offered and never wider than the column it is pasted into.
 */
export const embedSnippet = (
  request: EmbedRequest,
  pair: string,
  hookMayAlterSwaps: boolean,
  locale: Locale,
): string =>
  `<iframe src="${escapeHtml(embedCardUrl(request, locale))}" title="${escapeHtml(
    getEmbedCopy(locale).frameTitle(pair),
  )}" width="${EMBED_FRAME_WIDTH}" height="${embedFrameHeight(hookMayAlterSwaps)}" style="border:0;max-width:100%" loading="lazy"></iframe>`;
