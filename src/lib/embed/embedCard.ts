import { chainLabel } from "../chains/chainLabel";
import { formatFeePpm, formatMultiplier, formatPrice, formatWhole } from "../format/displayFormats";
import { getDictionary } from "../i18n/dictionaries";
import { getEmbedCopy } from "../i18n/embedCopy";
import { directionOf, type Locale } from "../i18n/locales";
import { SITE_URL } from "../site/indexing";
import type { PoolEmbedFigures } from "./poolEmbed";

/*
 * The card itself: a whole document, written out here rather than rendered
 * by the framework, because a page rendered by the framework comes inside the
 * site's layout — its header, its footer, its fonts and its scripts — and a
 * card in somebody else's page wants none of that. What is left is about two
 * kilobytes with no script in it, which is also what lets it carry a policy
 * that allows nothing to load (see security/responseHeaders.ts).
 *
 * Its words are the pool page's — the range heading, the current price, the
 * range written the same way round, the hook note — so a reader following the
 * link finds the same thing said the same way. Its colours are the site's,
 * light or dark as the reader's system is: the card cannot see the page
 * around it, and the reader's own setting is the one thing both pages share.
 *
 * Everything that came from a token contract — a symbol is whatever its
 * contract says — is escaped before it goes in, like every other value.
 */

export type EmbedCard =
  | { readonly kind: "pool"; readonly figures: PoolEmbedFigures }
  /** A pool named well that could not be read just now: the link still goes to its page. */
  | { readonly kind: "unreadable"; readonly poolUrl: string }
  | { readonly kind: "not-a-pool" };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Text or an attribute value, made inert. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);

/* The site's palette (app/globals.css), both schemes. */
const STYLE = `
:root{color-scheme:light dark;--bg:#fffdfd;--fg:#281c27;--muted:#746570;--border:#e7dfe5;--accent:#bd3b74;--warn-bg:#f6f0ee;--warn-fg:#77604d}
@media (prefers-color-scheme:dark){:root{--bg:#1c171e;--fg:#f5edf3;--muted:#b5a6b3;--border:#352b35;--accent:#ee9cbe;--warn-bg:#211b19;--warn-fg:#c6b5a0}}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:13px/1.35 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
p{margin:0}
.card{display:flex;flex-direction:column;gap:5px;min-height:100%;padding:12px 14px;border:1px solid var(--border);border-radius:12px;overflow-wrap:anywhere}
.head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:0 10px}
.pair{font-size:17px;font-weight:600}
.muted{color:var(--muted);font-size:11.5px}
.range{font:600 16px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.note{font-size:11.5px;padding:3px 7px;border-radius:6px;background:var(--warn-bg);color:var(--warn-fg)}
.foot{margin-top:auto;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:0 10px;font-size:11.5px;color:var(--muted)}
a{color:var(--accent);font-weight:600;text-decoration:none}
a:hover,a:focus-visible{text-decoration:underline}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
`;

const wholePage = (locale: Locale, title: string, body: string): string => `<!doctype html>
<html lang="${locale}" dir="${directionOf(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main class="card">
${body}
</main>
</body>
</html>
`;

/** The way back to the site, out of the frame: a card that navigated inside itself would show a page that refuses to be framed. */
const footer = (locale: Locale, href: string): string => {
  const copy = getEmbedCopy(locale);
  return `<p class="foot"><span>${escapeHtml(copy.notAdvice)}</span><a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(
    copy.analysedBy,
  )}<span class="sr"> (${escapeHtml(copy.newTab)})</span></a></p>`;
};

const poolCard = (figures: PoolEmbedFigures, locale: Locale): string => {
  const t = getDictionary(locale);
  const copy = getEmbedCopy(locale);
  const price = (value: number) => formatPrice(value, locale);
  const pair = `${figures.pair.token0} / ${figures.pair.token1}`;
  const fee = figures.lpFeePpm === null ? t.report.noDeclaredFee : formatFeePpm(figures.lpFeePpm, locale);
  const drawnFor = copy.drawnFor(
    t.parameters.days(formatWhole(figures.parameters.horizonDays, locale)),
    t.parameters.sigma(formatMultiplier(figures.parameters.standardDeviationMultiplier, locale)),
  );

  const lines = [
    `<div class="head"><p class="pair">${escapeHtml(pair)}</p><p class="muted">${escapeHtml(
      t.report.poolSummary(figures.protocol, fee, chainLabel(figures.chain.id, locale)),
    )}</p></div>`,
    `<p class="muted">${escapeHtml(`${t.report.rangeHeading} · ${drawnFor}`)}</p>`,
    `<p class="range">${escapeHtml(
      t.report.rangeValue(price(figures.range.lower), price(figures.range.upper), figures.price.quote, figures.price.base),
    )}</p>`,
    `<p class="muted">${escapeHtml(t.report.currentPrice)} <span class="mono">${escapeHtml(
      t.report.priceSentence(figures.price.base, price(figures.price.current), figures.price.quote),
    )}</span></p>`,
    /* Only while it is true, as on the page. */
    figures.range.currentInRange ? null : `<p class="note">${escapeHtml(t.report.inRangeNo)}</p>`,
    /*
     * The note every v4 figure drawn from the curve carries where the hook may
     * alter swaps — and only there: not on a liquidity-only hook, a hookless
     * v4 pool or v3.
     */
    figures.hookMayAlterSwaps ? `<p class="note">${escapeHtml(`${t.feeTiers.hook}: ${t.feeTiers.hookAltersSwaps}`)}</p>` : null,
    footer(locale, figures.poolUrl),
  ];

  return wholePage(locale, `${pair} · LiquidityWise`, lines.filter((line) => line !== null).join("\n"));
};

/** A card with nothing to show: one sentence and the way back, never an error page. */
const emptyCard = (locale: Locale, sentence: string, href: string): string =>
  wholePage(
    locale,
    "LiquidityWise",
    [`<p class="pair">LiquidityWise</p>`, `<p class="muted">${escapeHtml(sentence)}</p>`, footer(locale, href)].join("\n"),
  );

export const embedCardHtml = (card: EmbedCard, locale: Locale): string => {
  const copy = getEmbedCopy(locale);
  switch (card.kind) {
    case "pool":
      return poolCard(card.figures, locale);
    case "unreadable":
      return emptyCard(locale, copy.unreadable, card.poolUrl);
    case "not-a-pool":
      return emptyCard(locale, copy.notAPool, SITE_URL);
  }
};
