"use client";

import { ERROR_COPY } from "../lib/i18n/errorCopy";
import { LOCALES } from "../lib/i18n/locales";

/**
 * What a reader sees when the layout itself threw.
 *
 * This file replaces the root layout rather than rendering inside it, so
 * everything the rest of the site takes for granted is gone: the stylesheet,
 * the fonts, the theme the reader chose, and the `lang` the server had worked
 * out. It has to write its own document, and it cannot ask anybody anything.
 *
 * Which is why it is in both languages at once. The alternative is to guess,
 * and a screen that guesses wrong here has no second chance to correct itself —
 * there is no navigation left, no preference bar, and nothing below it that
 * works. Two short paragraphs cost less than one wrong one.
 *
 * Styling is inline for the same reason the refusal page in `proxy.ts` is: no
 * stylesheet is loaded at this point. `color-scheme: light dark` hands the
 * choice to the operating system, since the reader's own is stored in a theme
 * attribute this document never received.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, padding: "1.5rem", colorScheme: "light dark" }}>
        {/* `metadata` is not supported in a Client Component; this is. */}
        <title>{LOCALES.map((locale) => ERROR_COPY[locale].globalTitle).join(" · ")}</title>

        <main
          style={{
            maxWidth: "34rem",
            margin: "0 auto",
            font: "16px/1.6 ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {LOCALES.map((locale) => (
            <section key={locale} lang={locale}>
              <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>
                {ERROR_COPY[locale].globalTitle}
              </h1>
              <p style={{ margin: "0 0 1.5rem" }}>{ERROR_COPY[locale].globalBody}</p>
            </section>
          ))}

          <button type="button" onClick={retry} style={{ font: "inherit", padding: "0.5rem 1rem" }}>
            {LOCALES.map((locale) => ERROR_COPY[locale].retry).join(" · ")}
          </button>
        </main>
      </body>
    </html>
  );
}
