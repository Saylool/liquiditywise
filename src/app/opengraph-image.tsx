import { ImageResponse } from "next/og";

/*
 * The card a link to the site unfurls into, on Telegram, X, Discord and the
 * rest. Before it, a shared link was a bare URL.
 *
 * English, like the page a crawler is served. The site's own mark and its
 * dark palette, drawn rather than loaded: the brand fonts ship as woff2, which
 * the image renderer cannot read, so the renderer's own face is used. Made
 * once at build time; nothing in it changes per request.
 */

export const alt = "LiquidityWise — Uniswap v3 and v4 ranges, read from the chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKGROUND = "#120f14";
const SURFACE = "#1c171e";
const FOREGROUND = "#f5edf3";
const MUTED = "#b5a6b3";
const ACCENT = "#ee9cbe";

/** The mark from icon.svg, scaled. */
const MARK = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#20151f"/><g transform="translate(7 7)" stroke="#f6a4c6" fill="none" stroke-width="2.5" stroke-linecap="round"><path d="M8 9v10a9 9 0 0 0 18 0V9M13 6v13a4 4 0 0 0 8 0V6"/><circle cx="26" cy="6" r="1"/></g></svg>',
)}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: BACKGROUND,
          color: FOREGROUND,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={MARK} width={112} height={112} alt="" />
          <div style={{ display: "flex", fontSize: 64, fontWeight: 600, letterSpacing: -1 }}>LiquidityWise</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 54, lineHeight: 1.15, maxWidth: 1000 }}>
            Uniswap v3 and v4 ranges, worked out from the chain&apos;s own figures.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED, maxWidth: 1000, lineHeight: 1.35 }}>
            Every number computed and checked. The explanation is written from them and never states one of its own.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              background: SURFACE,
              color: ACCENT,
            }}
          >
            liquiditywise.com
          </div>
          <div style={{ display: "flex", color: MUTED }}>Ten languages · information only, not advice</div>
        </div>
      </div>
    ),
    size,
  );
}
