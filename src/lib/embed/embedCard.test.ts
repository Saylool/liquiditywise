import { describe, expect, it } from "vitest";

import { ETHEREUM } from "../chains/chains";
import { formatPrice } from "../format/displayFormats";
import { LOCALES } from "../i18n/locales";
import { fixtureAnalysis, SWAP_HOOK, V3_POOL_ID, V4_POOL_ID } from "../testing/poolAnalysisFixture";
import { embedCardHtml, escapeHtml } from "./embedCard";
import { poolEmbedFigures } from "./poolEmbed";

const v3 = poolEmbedFigures(fixtureAnalysis(), { protocol: "v3", chain: ETHEREUM, poolId: V3_POOL_ID });
const hooked = poolEmbedFigures(fixtureAnalysis("v4", SWAP_HOOK), { protocol: "v4", chain: ETHEREUM, poolId: V4_POOL_ID });
const card = (figures = v3, locale: (typeof LOCALES)[number] = "en") => embedCardHtml({ kind: "pool", figures }, locale);

describe("the embedded card", () => {
  const html = card();

  it("names the pair, the protocol, the fee and the network", () => {
    expect(html).toContain("USDC / WETH");
    expect(html).toContain("Uniswap v3 · Ethereum mainnet · 0.30%");
  });

  it("shows the suggested range and the current price as the pool page writes them", () => {
    expect(html).toContain(`${formatPrice(v3.range.lower)} – ${formatPrice(v3.range.upper)} USDC per WETH`);
    expect(html).toContain(`1 WETH = ${formatPrice(v3.price.current)} USDC`);
    expect(html).toContain("Current price");
  });

  it("says which horizon and width the range was drawn for", () => {
    expect(html).toContain("Suggested price range · 30 days, 1σ");
  });

  it("says it is not advice, and links back to the pool's page out of the frame", () => {
    expect(html).toContain("Not financial advice.");
    expect(html).toContain(
      `<a href="https://liquiditywise.com/pool?address=${V3_POOL_ID}&amp;days=30&amp;sigma=1" target="_blank" rel="noopener">Analysed by LiquidityWise`,
    );
    expect(html).toContain("opens in a new tab");
  });

  /* Nothing for a cross-origin frame to run, prefetch or load. */
  it("is a whole page with no script, no prefetch and nothing loaded from anywhere", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script|prefetch|preload|<link|<img|src=/i);
    expect(html).toContain("prefers-color-scheme:dark");
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  it("carries the hook note on a v4 pool whose hook may change what a swap costs, and nowhere else", () => {
    expect(card(hooked)).toContain("hook: may change what a swap costs");
    expect(html).not.toContain("may change what a swap costs");
  });

  it("says when the price is outside the range, and only then", () => {
    expect(html).not.toContain("outside this range");
    expect(card({ ...v3, range: { ...v3.range, currentInRange: false } })).toContain("The current price is outside this range.");
  });

  it("names a fee set by the hook rather than inventing one", () => {
    expect(card({ ...hooked, lpFeePpm: null })).toContain("fee set by its hook on every swap");
  });

  it("speaks the language it is asked in, and runs right to left in Arabic", () => {
    const turkish = card(v3, "tr");
    expect(turkish).toContain('<html lang="tr" dir="ltr">');
    expect(turkish).toContain("Önerilen fiyat aralığı");
    expect(turkish).toContain("Yatırım tavsiyesi değildir.");
    expect(turkish).not.toContain("Not financial advice");
    expect(card(v3, "ar")).toContain('<html lang="ar" dir="rtl">');
  });

  it("renders in every language", () => {
    for (const locale of LOCALES) expect(card(v3, locale), locale).toContain("LiquidityWise");
  });

  /* A symbol is whatever its token contract says. */
  it("escapes what came from a token contract", () => {
    const hostile = card({ ...v3, pair: { token0: '<img src=x onerror="alert(1)">', token1: "WETH" }, price: { ...v3.price, base: "<b>" } });

    expect(hostile).not.toContain("<img");
    expect(hostile).not.toContain("<b>");
    expect(hostile).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(escapeHtml(`a&b'"`)).toBe("a&amp;b&#39;&quot;");
  });
});

describe("a card with nothing to show", () => {
  it("says the pool could not be read, never an error, and still links to its page", () => {
    const html = embedCardHtml({ kind: "unreadable", poolUrl: "https://liquiditywise.com/pool?address=0xabc" }, "en");

    expect(html).toContain("This pool could not be read just now.");
    expect(html).toContain('href="https://liquiditywise.com/pool?address=0xabc" target="_blank" rel="noopener"');
    expect(html).not.toMatch(/Error|at \w+ \(|stack/);
  });

  it("says an address names no pool, and links to the site", () => {
    const html = embedCardHtml({ kind: "not-a-pool" }, "de");

    expect(html).toContain("Diese Karte nennt keinen Pool, den LiquidityWise liest.");
    expect(html).toContain('href="https://liquiditywise.com" target="_blank" rel="noopener"');
  });
});
