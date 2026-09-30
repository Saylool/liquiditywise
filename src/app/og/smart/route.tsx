import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { readSmartCard } from "@/lib/og/readSmartCard";

/*
 * The card a shared smart-money link unfurls into: where the best-earning
 * liquidity sits, in the site's own palette.
 *
 * Outside /api/ for the reason the pool card is (see og/pool/route.tsx). Its
 * figures are measured every six hours, so it is kept six — and only five
 * minutes when there is nothing measured to say yet, so the plain card that
 * stands in for it does not outlive the first measurement.
 */

const BACKGROUND = "#120f14";
const SURFACE = "#1c171e";
const FOREGROUND = "#f5edf3";
const MUTED = "#b5a6b3";
const ACCENT = "#ee9cbe";

const MARK = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#20151f"/><g transform="translate(7 7)" stroke="#f6a4c6" fill="none" stroke-width="2.5" stroke-linecap="round"><path d="M8 9v10a9 9 0 0 0 18 0V9M13 6v13a4 4 0 0 0 8 0V6"/><circle cx="26" cy="6" r="1"/></g></svg>',
)}`;

const SIX_HOURS_SECONDS = 21_600;
const FIVE_MINUTES_SECONDS = 300;

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const text = readSmartCard(request.nextUrl.searchParams);
  const seconds = text === null ? FIVE_MINUTES_SECONDS : SIX_HOURS_SECONDS;

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
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* The image renderer draws plain elements only; next/image has no meaning inside it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK} width={84} height={84} alt="" />
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>LiquidityWise</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 40, color: ACCENT }}>Where smart liquidity sits</div>
          <div style={{ display: "flex", fontSize: text === null ? 54 : 84, fontWeight: 600, letterSpacing: -2 }}>
            {text === null ? "The Uniswap v3 positions that earn the most, and where they put their money." : text.pair}
          </div>
          {text === null ? null : <div style={{ display: "flex", fontSize: 44 }}>{text.range}</div>}
          <div style={{ display: "flex", fontSize: 30, color: MUTED, maxWidth: 1000, lineHeight: 1.35 }}>
            {text === null
              ? "Measured from the chain: fees earned since each position was last changed, against what it is worth now."
              : text.summary}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
          <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: SURFACE, color: ACCENT }}>
            liquiditywise.com/smart-money
          </div>
          <div style={{ display: "flex", color: MUTED }}>Information only, not advice</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds}` },
    },
  );
}
