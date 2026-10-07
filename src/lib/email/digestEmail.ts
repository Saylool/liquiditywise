import { chainOf } from "../chains/chains";
import type { Dictionary } from "../i18n/dictionaries";
import type { EmailDigestCopy } from "../i18n/emailDigestCopy";
import { localePath } from "../i18n/localePath";
import { directionOf, type Locale } from "../i18n/locales";
import type { WeeklyCopy } from "../i18n/weeklyCopy";
import { SITE_URL } from "../site/indexing";
import { smartMoneyUrl, weeklyDigestParts } from "../telegram/messages";
import type { WeeklyDigest } from "../telegram/weeklyDigest";
import type { EmailMessage } from "./provider";
import { signToken, type TokenClaims } from "./signedToken";

/*
 * The two mails this application sends, composed.
 *
 * **The digest** is the bot's Monday message, part for part
 * (telegram/messages.ts): the same heading, the same lists, the same note
 * that it is a measurement and not a suggestion, the same link to the
 * smart-money page, the same footer. The plain-text body *is* that message,
 * with two lines after it — the digest as a page, and the link that stops
 * these mails. The HTML lays the same parts out, nothing more: a heading,
 * lists, two paragraphs, two links. A reader whose mail client shows text
 * only, or reads it aloud, is told everything the HTML says.
 *
 * **The confirmation** says who asked for what, where to confirm it, and
 * what happens if nobody does: nothing, within a day.
 *
 * The HTML is deliberately plain. Mail clients honour a fraction of CSS and
 * no two the same fraction, so everything that matters is inline on the
 * element, in the site's own light colours, and a `prefers-color-scheme`
 * block turns the few clients that read one to the site's dark ones. Every
 * string that reaches the markup is escaped — a token symbol can contain
 * anything a subgraph was told it does.
 *
 * Every digest carries the one-click unsubscribe headers (RFC 8058) besides
 * the link in its body, so a mail client's own "unsubscribe" button works too
 * and posts to the same address the link opens. The unsubscribe token has no
 * expiry: the link in last spring's digest has to work as well as this
 * morning's. Pure: the token is signed from the secret handed in, the time
 * from the clock handed in.
 */

export type DigestEmailInput = {
  readonly digest: WeeklyDigest;
  readonly chainId: number;
  readonly locale: Locale;
  readonly t: Dictionary;
  readonly copy: EmailDigestCopy;
  readonly weekly: WeeklyCopy;
  /** The subscription's id, which the unsubscribe link carries, signed. */
  readonly subscriptionId: string;
  readonly secret: string;
};

export type ConfirmationEmailInput = {
  readonly chainId: number;
  readonly locale: Locale;
  readonly copy: EmailDigestCopy;
  readonly subscriptionId: string;
  readonly secret: string;
  /** When the link stops working: a day from when it was asked for (signedToken.ts). */
  readonly expiresAt: Date;
};

/** The weekly page in the reader's language, on the digest's chain — written the way the smart-money link is. */
export const weeklyPageUrl = (locale: Locale, chainId: number): string =>
  `${SITE_URL}${localePath(locale, "/weekly")}?chain=${chainOf(chainId).slug}`;

export const confirmUrl = (secret: string, subscriptionId: string, expiresAt: Date): string =>
  `${SITE_URL}/weekly/confirm?token=${signToken(secret, { purpose: "confirm", id: subscriptionId, expiresAtMs: expiresAt.getTime() })}`;

export const unsubscribeUrl = (secret: string, subscriptionId: string): string => {
  const claims: TokenClaims = { purpose: "unsubscribe", id: subscriptionId, expiresAtMs: null };
  return `${SITE_URL}/weekly/unsubscribe?token=${signToken(secret, claims)}`;
};

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/*
 * The site's palette (app/globals.css), light by default and dark where the
 * client says so. Names rather than tokens, because a mail has no stylesheet
 * to name them in — these are the same hexes.
 */
const LIGHT = { background: "#faf8fa", surface: "#fffdfd", foreground: "#281c27", muted: "#746570", border: "#e7dfe5", accent: "#a32960" };
const DARK = { background: "#120f14", surface: "#1c171e", foreground: "#f5edf3", muted: "#b5a6b3", border: "#352b35", accent: "#f9b7d2" };

type Block =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "subheading"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "paragraph"; readonly text: string; readonly muted?: boolean }
  | { readonly kind: "link"; readonly label: string; readonly href: string; readonly button?: boolean };

const TEXT = `font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6;`;

const blockHtml = (block: Block): string => {
  switch (block.kind) {
    case "heading":
      /* The bot's heading is two lines; the first is the title and the second its subtitle. */
      return block.text
        .split("\n")
        .map((line, index) =>
          index === 0
            ? `<h1 style="margin: 0 0 4px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em;">${escapeHtml(line)}</h1>`
            : `<p class="muted" style="margin: 0 0 20px; color: ${LIGHT.muted};">${escapeHtml(line)}</p>`,
        )
        .join("");
    case "subheading":
      return `<h2 style="margin: 20px 0 6px; font-size: 16px; font-weight: 600;">${escapeHtml(block.text)}</h2>`;
    case "list":
      return `<ul style="margin: 0; padding: 0 0 0 20px;">${block.items.map((item) => `<li style="margin: 0 0 4px;">${escapeHtml(item)}</li>`).join("")}</ul>`;
    case "paragraph":
      return `<p${block.muted ? ` class="muted" style="margin: 16px 0 0; color: ${LIGHT.muted};"` : ' style="margin: 16px 0 0;"'}>${escapeHtml(block.text)}</p>`;
    case "link":
      return block.button
        ? `<p style="margin: 20px 0;"><a class="button" href="${escapeHtml(block.href)}" style="display: inline-block; padding: 10px 18px; border-radius: 6px; background: ${LIGHT.accent}; color: #ffffff; text-decoration: none; font-weight: 500;">${escapeHtml(block.label)}</a></p>`
        : `<p style="margin: 12px 0 0;"><a class="link" href="${escapeHtml(block.href)}" style="color: ${LIGHT.accent};">${escapeHtml(block.label)}</a></p>`;
  }
};

/** One mail as a document: the blocks on a card, in the reader's language and direction. */
export const emailDocument = (locale: Locale, title: string, blocks: readonly Block[]): string => `<!doctype html>
<html lang="${locale}" dir="${directionOf(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .page { background: ${DARK.background} !important; color: ${DARK.foreground} !important; }
    .card { background: ${DARK.surface} !important; border-color: ${DARK.border} !important; }
    .muted { color: ${DARK.muted} !important; }
    .link { color: ${DARK.accent} !important; }
    .button { background: ${DARK.accent} !important; color: #2a1521 !important; }
  }
</style>
</head>
<body class="page" style="margin: 0; padding: 24px 16px; background: ${LIGHT.background}; color: ${LIGHT.foreground}; ${TEXT}">
<div class="card" style="max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid ${LIGHT.border}; border-radius: 12px; background: ${LIGHT.surface};">
${blocks.map(blockHtml).join("\n")}
</div>
</body>
</html>
`;

/** The digest for one subscriber: the bot's message as text and as HTML, with the links an e-mail needs and the headers a mail client reads. */
export const digestEmail = ({ digest, chainId, locale, t, copy, weekly, subscriptionId, secret }: DigestEmailInput): Omit<EmailMessage, "to"> => {
  const parts = weeklyDigestParts(digest, t, locale, chainId);
  const page = weeklyPageUrl(locale, chainId);
  const stop = unsubscribeUrl(secret, subscriptionId);
  const subject = weekly.titleOn(chainOf(chainId).name);

  const text = [
    parts.heading,
    ...parts.sections.map(({ heading, items }) => [heading, ...items.map((item) => `• ${item}`)].join("\n")),
    `${parts.note}\n${parts.link}`,
    `${copy.mail.digestPage} ${page}`,
    parts.footer,
    `${copy.mail.unsubscribeLink}: ${stop}`,
  ].join("\n\n");

  const html = emailDocument(locale, subject, [
    { kind: "heading", text: parts.heading },
    ...parts.sections.flatMap(({ heading, items }): Block[] => [
      { kind: "subheading", text: heading },
      { kind: "list", items },
    ]),
    { kind: "paragraph", text: parts.note },
    { kind: "link", label: parts.link, href: smartMoneyUrl(locale, chainId) },
    { kind: "link", label: `${copy.mail.digestPage} ${page}`, href: page },
    { kind: "paragraph", text: parts.footer, muted: true },
    { kind: "link", label: copy.mail.unsubscribeLink, href: stop },
  ]);

  return {
    subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${stop}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
};

/** The mail that asks the mailbox's owner whether they meant it. */
export const confirmationEmail = ({ chainId, locale, copy, subscriptionId, secret, expiresAt }: ConfirmationEmailInput): Omit<EmailMessage, "to"> => {
  const chain = chainOf(chainId).name;
  const href = confirmUrl(secret, subscriptionId, expiresAt);
  const subject = copy.mail.confirmSubject(chain);

  return {
    subject,
    text: [copy.mail.confirmIntro(chain), `${copy.mail.confirmLink}: ${href}`, copy.mail.confirmIgnore].join("\n\n"),
    html: emailDocument(locale, subject, [
      { kind: "heading", text: subject },
      { kind: "paragraph", text: copy.mail.confirmIntro(chain) },
      { kind: "link", label: copy.mail.confirmLink, href, button: true },
      { kind: "paragraph", text: copy.mail.confirmIgnore, muted: true },
    ]),
  };
};
