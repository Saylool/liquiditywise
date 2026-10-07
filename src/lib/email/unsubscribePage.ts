import { getEmailDigestCopy } from "../i18n/emailDigestCopy";
import { directionOf, type Locale } from "../i18n/locales";
import { getWeeklyCopy } from "../i18n/weeklyCopy";
import { localePath } from "../i18n/localePath";
import { escapeHtml } from "./digestEmail";
import type { UnsubscribeOutcome } from "./subscriptions";

/*
 * The page the link at the foot of every digest opens, written by hand.
 *
 * Self-contained, like the proxy's refusal page, because the route that
 * serves it answers a POST as well as a GET: a mail client's own unsubscribe
 * button posts to the same address the link opens (RFC 8058, the
 * `List-Unsubscribe-Post` header every digest carries), and a page under the
 * application's layout can answer only GET. So the route is a handler and the
 * page is a string; what it says is this file's, under test, and the route
 * only chooses which.
 *
 * Opening the link does not stop anything. Mail scanners follow every link
 * in a message before the reader has read it, and a link that unsubscribed
 * on being opened would unsubscribe readers who never asked to be. So the
 * page shows one button, and the button posts; the one-click POST from a
 * mail client is the same request. Nothing a GET does changes the store.
 */

export type UnsubscribeView = "ask" | "invalid" | UnsubscribeOutcome;

const STYLE = `
      :root { color-scheme: light dark; }
      body {
        margin: 0; padding: 1.5rem; min-height: 100vh;
        display: grid; place-items: center;
        font: 16px/1.6 ui-sans-serif, system-ui, sans-serif;
        background: #faf8fa; color: #281c27;
      }
      main { max-width: 34rem; }
      h1 { font-size: 1.5rem; margin: 0 0 1rem; }
      p { margin: 0 0 1rem; }
      a { color: #a32960; }
      button {
        font: inherit; padding: 0.6rem 1.1rem; border: 0; border-radius: 6px;
        background: #a32960; color: #ffffff; cursor: pointer;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #120f14; color: #f5edf3; }
        a { color: #f9b7d2; }
        button { background: #f9b7d2; color: #2a1521; }
      }`;

/**
 * The page for one state: the question with its button, or what pressing
 * it came to. `action` is the address the button posts to — the page's own,
 * token and all — and is escaped on the way in like everything else.
 */
export const unsubscribePage = (locale: Locale, view: UnsubscribeView, action: string): string => {
  const copy = getEmailDigestCopy(locale).unsubscribe;
  const message =
    view === "ask"
      ? copy.ask
      : view === "removed"
        ? copy.removed
        : view === "unknown"
          ? copy.unknown
          : view === "unavailable"
            ? copy.unavailable
            : copy.invalid;
  const form =
    view === "ask"
      ? `<form method="post" action="${escapeHtml(action)}"><button type="submit">${escapeHtml(copy.button)}</button></form>`
      : "";

  return `<!doctype html>
<html lang="${locale}" dir="${directionOf(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(copy.title)}</title>
    <style>${STYLE}
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(copy.title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${form}
      <p><a href="${localePath(locale, "/weekly")}">${escapeHtml(getWeeklyCopy(locale).link)}</a></p>
    </main>
  </body>
</html>
`;
};
