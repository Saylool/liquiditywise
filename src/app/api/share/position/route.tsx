import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { readEmbedLocale } from "@/lib/embed/embedRequest";
import { directionOf, type Locale } from "@/lib/i18n/locales";
import { loadCardFonts } from "@/lib/share/cardFonts";
import { type PositionCardText, positionCardText } from "@/lib/share/positionCard";
import { readPositionCard } from "@/lib/share/readPositionCard";
import { readShareRequest } from "@/lib/share/shareRequest";
import { SHARE_CARD_CACHE, shareFailureResponse } from "@/lib/share/shareResponses";
import { lineRuns } from "@/lib/share/visualOrder";

/*
 * The card a holder shares about one open v3 position: the pair, its range,
 * the fees it has earned over its whole life and how it has done against
 * simply holding, in the site's own palette and faces, in the language the
 * address names.
 *
 *   GET /api/share/position?chain=base&id=12345&lang=tr
 *
 * Drawn from the same record the holdings page shows under the position
 * (advisor/positionRecord.ts), read through the same readers and kept five
 * minutes per position, here and in any cache in front. A position whose
 * record could not be verified against the chain gets a plain card that says
 * so: never a partial figure. An address that names no position, or an id
 * the chain holds no open position under, is answered in JSON like the embed
 * API, not with a card — a link somebody else pasted deserves an answer a
 * script can test, and a card saying "no such position" would be shared as
 * if it were one.
 *
 * Under /api/ on purpose, unlike the pool cards: it reads one position live
 * from the chain and two sources, and the proxy charges it against the
 * reader's allowance as it charges the holdings page. Nothing about the
 * reader is on it or read for it; the address encodes the public token id.
 */

export const dynamic = "force-dynamic";

const BACKGROUND = "#120f14";
const SURFACE = "#1c171e";
const FOREGROUND = "#f5edf3";
const MUTED = "#b5a6b3";
const ACCENT = "#ee9cbe";
const BORDER = "#2a2230";

const MARK = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#20151f"/><g transform="translate(7 7)" stroke="#f6a4c6" fill="none" stroke-width="2.5" stroke-linecap="round"><path d="M8 9v10a9 9 0 0 0 18 0V9M13 6v13a4 4 0 0 0 8 0V6"/><circle cx="26" cy="6" r="1"/></g></svg>',
)}`;

const SERIF = "Instrument Serif";
const MONO = "Geist Mono";

/**
 * A line of words. On a right-to-left card its runs (see visualOrder.ts) are
 * laid out as flex items from the right, wrapping, so each row reads right
 * to left and the rows follow in order; elsewhere the string as it is.
 * Labels are written as they are, never upper-cased: the renderer knows no
 * language, and would turn a Turkish i into I.
 */
const Line = ({ rtl, children, style }: { rtl: boolean; children: string; style?: Record<string, string | number> }) =>
  rtl ? (
    <div style={{ display: "flex", flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "flex-start", columnGap: "0.3em", ...style }}>
      {lineRuns(children).map((run, index) => (
        <div key={index} style={{ display: "flex" }}>
          {run.text}
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: "flex", ...style }}>{children}</div>
  );

/** The whole card, laid out with flex alone: the renderer draws nothing else. */
const Card = ({ text, locale }: { text: PositionCardText; locale: Locale }) => {
  /* The rows of a right-to-left card mirror too, so the figures sit where its reader looks first. */
  const rtl = directionOf(locale) === "rtl";
  const pair = text.kind === "record" ? text.figures.pair : text.pair;
  const detail = text.kind === "record" ? text.figures.detail : text.detail;
  const row = rtl ? "row-reverse" : "row";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        background: BACKGROUND,
        color: FOREGROUND,
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", flexDirection: row, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* The image renderer draws plain elements only; next/image has no meaning inside it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK} width={64} height={64} alt="" />
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600, letterSpacing: -1 }}>LiquidityWise</div>
        </div>
        <Line rtl={rtl} style={{ fontSize: 24, color: MUTED, maxWidth: 620 }}>{text.title}</Line>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: row, alignItems: "baseline", gap: 28, flexWrap: "wrap" }}>
          <div style={{ display: "flex", fontFamily: SERIF, fontSize: 84, letterSpacing: -1, lineHeight: 1 }}>{pair}</div>
          <Line rtl={rtl} style={{ fontFamily: MONO, fontSize: 30, color: ACCENT }}>{detail}</Line>
        </div>

        {text.kind === "record" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 14 }}>
            {/* Two figures side by side, each in half the width, so neither can push the other off the card. */}
            <div style={{ display: "flex", flexDirection: row, gap: 48 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 504 }}>
                <Line rtl={rtl} style={{ fontSize: 24, color: MUTED, letterSpacing: 0.5 }}>{text.labels.range}</Line>
                <Line rtl={rtl} style={{ fontFamily: MONO, fontSize: 30 }}>{text.figures.range}</Line>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 504 }}>
                <Line rtl={rtl} style={{ fontSize: 24, color: MUTED, letterSpacing: 0.5 }}>{text.labels.fees}</Line>
                <Line rtl={rtl} style={{ fontFamily: MONO, fontSize: 30 }}>{text.figures.fees}</Line>
              </div>
            </div>
            {/* The result across the whole width, its two parts under it with room to wrap. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Line rtl={rtl} style={{ fontSize: 24, color: MUTED, letterSpacing: 0.5 }}>{text.labels.against}</Line>
              <Line rtl={rtl} style={{ fontFamily: MONO, fontSize: 48 }}>{text.figures.result}</Line>
              <Line rtl={rtl} style={{ width: "100%", fontFamily: MONO, fontSize: 24, color: MUTED, lineHeight: 1.3 }}>{text.figures.parts}</Line>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              marginTop: 26,
              padding: "24px 28px",
              borderRadius: 18,
              border: `2px solid ${BORDER}`,
              background: SURFACE,
              fontSize: 32,
              lineHeight: 1.35,
              color: MUTED,
            }}
          >
            <Line rtl={rtl}>{text.message}</Line>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: row, justifyContent: "space-between", alignItems: "center", fontSize: 24 }}>
        {text.kind === "record" ? (
          <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: SURFACE, color: ACCENT, fontFamily: MONO }}>
            <Line rtl={rtl}>{text.since}</Line>
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <Line rtl={rtl} style={{ color: MUTED }}>{text.footer}</Line>
      </div>
    </div>
  );
};

export async function GET(request: NextRequest): Promise<Response> {
  const parameters = request.nextUrl.searchParams;
  const asked = readShareRequest(parameters);
  if (asked === null) return shareFailureResponse("not-a-position");

  const read = await readPositionCard(asked);
  if (read.status === "unavailable") return shareFailureResponse("unreadable");
  if (read.status === "not-found") return shareFailureResponse("no-such-position");

  const locale = readEmbedLocale(parameters);
  const text = positionCardText(read.described, locale);
  const fonts = await loadCardFonts();

  return new ImageResponse(<Card text={text} locale={locale} />, {
    width: 1200,
    height: 630,
    ...(fonts.length === 0 ? {} : { fonts: [...fonts] }),
    headers: { "Cache-Control": SHARE_CARD_CACHE },
  });
}
