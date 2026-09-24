import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./redesign.css";

import { ErrorCopyProvider } from "@/components/ErrorCopyProvider";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { directionOf } from "@/lib/i18n/locales";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";
import { SITE_URL } from "@/lib/site/indexing";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/theme";

/*
 * Self-hosted rather than fetched from Google Fonts at build time.
 *
 * `next/font/google` downloads the font during `next build`, which makes the
 * build fail outright on any machine or CI runner that cannot reach
 * fonts.googleapis.com — an offline laptop, a locked-down runner, a sandbox
 * behind a proxy the font fetcher does not honour. Committing the files removes
 * that network dependency from the build entirely, and the bytes are served from
 * our own origin at runtime instead of a third party's.
 *
 * These are the variable builds, so one file per family covers the whole
 * 100-900 weight range.
 */
/*
 * `optional`, and only this one of the three.
 *
 * A metric-adjusted fallback matches a font's vertical metrics — Next builds
 * one for each of these from the file itself — but it cannot match the width
 * of every character. So paragraphs wrap at different words in the fallback
 * and at different words again once the real font arrives, and the page
 * changes height under the reader mid-sentence. Measured on the front page:
 * the footer moves 44px, and all 44 of them come from this family. The mono
 * and the display serif each move it by zero, because one sets short fixed
 * strings and the other sets headings that fit on their line either way.
 *
 * `optional` gives the font about a hundred milliseconds to arrive. If it
 * does — which it usually has, since Next preloads it — it is used from the
 * first paint. If it does not, the fallback is kept for that page view and
 * never swapped. Both roads end with no shift at all, where `swap` guarantees
 * one whenever the font is late.
 *
 * The cost is real and it is the reason the other two keep `swap`: a
 * first-time reader on a slow connection reads that page in the fallback.
 * For body text, which the adjusted fallback already resembles closely, that
 * is a far smaller thing than the page moving while it is being read. For the
 * display serif in the hero it would not be, so that one still swaps.
 */
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "optional",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

/*
 * WOFF2, converted from the TTF the project publishes.
 *
 * A TTF is served as-is and leans on the server's gzip; WOFF2 carries its own
 * Brotli and a font-specific transform, and it is the one format every browser
 * this application supports can read. Measured on this file: 70,012 bytes of
 * TTF, 35,590 gzipped, against 27,400 bytes of WOFF2 that needs no encoding at
 * all — and 42KB less for the browser to decompress before it can draw a
 * heading. The two Geist families were already WOFF2; this one was the odd one
 * out rather than a decision.
 *
 * The conversion is lossless and was checked as such: 377 glyphs and the same
 * glyph order in and out, the same 1000 units per em, the same name table.
 * OFL-1.1 permits it, and InstrumentSerif-OFL.txt stays beside the file.
 */
const displayFont = localFont({
  src: "./fonts/InstrumentSerif-Regular.woff2",
  variable: "--font-display",
  weight: "400",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();

  return {
    title: t.metadata.title,
    description: t.metadata.description,
    /*
     * Where relative URLs in the metadata below — and the card image the
     * opengraph-image file makes — are resolved against. Without it a shared
     * link's card points at localhost.
     */
    metadataBase: new URL(SITE_URL),
    openGraph: {
      type: "website",
      siteName: "LiquidityWise",
      title: t.metadata.title,
      description: t.metadata.description,
      url: "/",
    },
    twitter: { card: "summary_large_image", title: t.metadata.title, description: t.metadata.description },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, t } = await getRequestDictionary();

  return (
    <html
      lang={locale}
      /*
       * Arabic runs the other way, and one attribute is what turns the whole
       * document around: text alignment, the order of flex and grid children,
       * scrollbars, and every logical property the styles are written in. The
       * styles use `start`/`end` rather than `left`/`right` for exactly this —
       * a margin written as `left` would stay on the left in a language that
       * reads from the right, which is how a mirrored layout comes apart.
       */
      dir={directionOf(locale)}
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
      /*
       * The boot script below stamps `data-theme` on this element before React
       * hydrates, so the server's markup and the browser's DOM differ here by
       * design — and React reports that as a hydration error it cannot know is
       * intended. Suppressing it applies to this element's own attributes only,
       * not to anything inside, so nothing else is silenced.
       */
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/*
         * First thing in the body, and synchronous, so the stored theme is on
         * the root element before anything paints. Any later — including
         * anywhere React could put it — and a reader who chose dark gets a white
         * flash on every navigation.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/*
         * The error boundary below this is a Client Component and cannot ask the
         * request which language to render in. This is how the answer reaches
         * it: worked out here, where the request still exists, and handed down
         * as data. It wraps everything because the boundary can be anywhere.
         */}
        <SiteHeader locale={locale} t={t} />
        <ErrorCopyProvider copy={t.error}>{children}</ErrorCopyProvider>
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
