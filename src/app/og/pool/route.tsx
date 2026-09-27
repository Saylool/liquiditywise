import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { readPoolCard } from "@/lib/og/readPoolCard";

/*
 * The card a shared pool link unfurls into: the pair, the protocol, the fee
 * and the chain, in the site's own palette.
 *
 * Outside /api/ on purpose: robots.txt closes that to every crawler, and the
 * crawlers that fetch cards read robots.txt. A request that names no pool it
 * can read gets the site's own card instead of an error, so a link is never a
 * broken image in somebody's feed. Kept a day per pool, here and in any cache
 * in front, because nothing on it changes with the price.
 */

const BACKGROUND = "#120f14";
const SURFACE = "#1c171e";
const FOREGROUND = "#f5edf3";
const MUTED = "#b5a6b3";
const ACCENT = "#ee9cbe";

const MARK = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#20151f"/><g transform="translate(7 7)" stroke="#f6a4c6" fill="none" stroke-width="2.5" stroke-linecap="round"><path d="M8 9v10a9 9 0 0 0 18 0V9M13 6v13a4 4 0 0 0 8 0V6"/><circle cx="26" cy="6" r="1"/></g></svg>',
)}`;

/** A day, here and in any cache in front: nothing on the card changes with the price. */
const DAY_SECONDS = 86_400;

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const params = request.nextUrl.searchParams;
  const text = await readPoolCard(params);

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
          <div style={{ display: "flex", fontSize: text === null ? 54 : 96, fontWeight: 600, letterSpacing: -2 }}>
            {text === null ? "Uniswap v3 and v4 ranges, worked out from the chain's own figures." : text.pair}
          </div>
          {text === null ? null : (
            <div style={{ display: "flex", fontSize: 38, color: ACCENT }}>{text.detail}</div>
          )}
          <div style={{ display: "flex", fontSize: 30, color: MUTED, maxWidth: 1000, lineHeight: 1.35 }}>
            A price range from how far this pool&apos;s price has actually moved — every figure computed, none guessed.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
          <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: SURFACE, color: ACCENT }}>
            liquiditywise.com
          </div>
          <div style={{ display: "flex", color: MUTED }}>Information only, not advice</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": `public, max-age=${DAY_SECONDS}, s-maxage=${DAY_SECONDS}` },
    },
  );
}
