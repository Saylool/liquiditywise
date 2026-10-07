import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { chainById, V3_POSITION_CHAINS } from "../lib/chains/chains";
import { formatFeePpm, formatPercent, formatPrice, formatUtcMinute, formatWhole } from "../lib/format/displayFormats";
import type { EmailFormStatus } from "../lib/email/formStatus";
import { getDictionary } from "../lib/i18n/dictionaries";
import { getEmailDigestCopy } from "../lib/i18n/emailDigestCopy";
import { getHomeAlertsCopy } from "../lib/i18n/homeAlertsCopy";
import type { Locale } from "../lib/i18n/locales";
import { getSmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import { getWeeklyCopy } from "../lib/i18n/weeklyCopy";
import type { WeeklyDigest, WeeklyReading } from "../lib/telegram/weeklyDigest";
import { smartMoneyHref, WeeklyDigestPage } from "./WeeklyDigestPage";

/* React escapes an apostrophe and a quote in text; the copy uses both. */
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

const BOT = { username: "LiquidityWiseBot", url: "https://t.me/LiquidityWiseBot" };
const WINDOW = { from: "2026-09-28T09:00:00.000Z", to: "2026-10-05T06:00:00.000Z", days: 6.875 };

/* USDC/WETH as token0/token1, so its prices are WETH per USDC and are quoted the other way up, as USDC per WETH. */
const DIGEST: WeeklyDigest = {
  days: 6.875,
  gaining: [{ pool: "0xb", pair: "WETH / USDT", feePpm: 3000, from: 0.4, to: 0.7 }],
  losing: [{ pool: "0xa", pair: "USDC / WETH", feePpm: 500, from: 0.6, to: 0.3 }],
  ranges: [
    { pool: "0xa", pair: "USDC / WETH", feePpm: 500, then: [0.0003, 0.0005], now: [0.0004, 0.0006], currentPrice: 0.0005 },
    { pool: "0xb", pair: "WETH / USDT", feePpm: 3000, then: [2800, 3200], now: [3300, 3900], currentPrice: 3500 },
  ],
};
const TOP = [
  { pool: "0xb", pair: "WETH / USDT", feePpm: 3000, yearlyYield: 0.41, positions: 9 },
  { pool: "0xa", pair: "USDC / WETH", feePpm: 500, yearlyYield: 0.34, positions: 12 },
];

const MOVED: WeeklyReading = { status: "moved", window: WINDOW, topYields: TOP, digest: DIGEST };
const QUIET: WeeklyReading = { status: "quiet", window: WINDOW, topYields: TOP };
const NOT_YET: WeeklyReading = { status: "not-yet" };

const render = (
  reading: WeeklyReading | null,
  chainId = 1,
  locale: Locale = "en",
  bot: typeof BOT | null = null,
  email: { offered: boolean; status: EmailFormStatus | null } = { offered: false, status: null },
) =>
  renderToStaticMarkup(
    <WeeklyDigestPage
      reading={reading}
      chain={chainById(chainId as 1)}
      chains={V3_POSITION_CHAINS}
      pageHref={`/${locale}/weekly`}
      networkLabel="Network"
      copy={getWeeklyCopy(locale)}
      t={getDictionary(locale)}
      locale={locale}
      bot={bot}
      email={{ ...email, copy: getEmailDigestCopy(locale), action: async () => {} }}
    />,
  );

/** Each list item's text, so a line can be read apart from the headings around it. */
const items = (html: string): string[] => [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, text]) => text ?? "");

const en = getDictionary("en");
const copy = getWeeklyCopy("en");

describe("the weekly page", () => {
  it("offers a tab for every chain the smart money is measured on, the current one marked", () => {
    const html = render(MOVED, 8453);

    expect(html).toContain('href="/en/weekly"');
    expect(html).toContain('href="/en/weekly?chain=base"');
    expect(html).toContain('href="/en/weekly?chain=polygon"');
    expect(html).not.toContain("unichain");
    expect(html).toMatch(/href="\/en\/weekly\?chain=base" aria-current="page"/);
  });

  it("says where positions cannot be listed, and tells nothing of a week there", () => {
    const html = render(null, 130);

    expect(html).toContain(escaped(getSmartLiquidityCopy("en").notRead("Unichain", V3_POSITION_CHAINS.map(({ name }) => name).join(", "))));
    expect(html).not.toContain(escaped(copy.intro("Unichain")));
    expect(html).not.toContain("→");
  });

  it("says the kept measurements could not be read, rather than that nothing moved", () => {
    const html = render(null);

    expect(html).toContain(escaped(copy.intro("Ethereum")));
    expect(html).toContain(escaped(copy.unavailable));
    expect(html).not.toContain(escaped(copy.quiet));
    expect(html).not.toContain(escaped(en.telegram.weeklyNote));
  });

  it("says there is not yet a day to compare, naming the chain, and dates no week", () => {
    const html = render(NOT_YET, 137);

    expect(html).toContain(escaped(copy.notYet("Polygon")));
    expect(html).not.toContain(formatUtcMinute(WINDOW.from));
    expect(html).not.toContain(escaped(en.telegram.weeklyGaining));
    expect(html).toContain('href="/en/smart-money?chain=polygon"');
  });

  it("dates the week from its first measurement to its latest, under the heading the bot's message opens with", () => {
    const html = render(QUIET);

    expect(html).toContain(escaped(getSmartLiquidityCopy("en").trend.heading("7")));
    expect(html).toContain(escaped(copy.window(formatUtcMinute(WINDOW.from), formatUtcMinute(WINDOW.to), "7")));
    expect(html).toContain("2026-09-28 09:00 UTC");
    expect(html).toContain("2026-10-05 06:00 UTC");
  });

  it("says a quiet week was quiet, and still names what earned the most", () => {
    const html = render(QUIET);

    expect(html).toContain(escaped(copy.quiet));
    expect(html).not.toContain(escaped(en.telegram.weeklyGaining));
    expect(html).not.toContain(escaped(en.telegram.weeklyRanges));
    expect(html).toContain(escaped(copy.topHeading));
    expect(items(html)).toEqual([
      `WETH / USDT · ${formatFeePpm(3000, "en")}: ${copy.topYield(formatPercent(0.41, "en"), "9")}`,
      `USDC / WETH · ${formatFeePpm(500, "en")}: ${copy.topYield(formatPercent(0.34, "en"), "12")}`,
    ]);
  });

  it("names the movers each way with their share then → now, as the bot's message does, gaining first", () => {
    const html = render(MOVED, 8453);

    expect(html).toContain(escaped(en.telegram.weeklyGaining));
    expect(html).toContain(escaped(en.telegram.weeklyLosing));
    expect(html.indexOf(escaped(en.telegram.weeklyGaining))).toBeLessThan(html.indexOf(escaped(en.telegram.weeklyLosing)));
    expect(items(html)).toContain(`WETH / USDT · ${formatFeePpm(3000, "en")}: ${formatPercent(0.4, "en")} → ${formatPercent(0.7, "en")}`);
    expect(items(html)).toContain(`USDC / WETH · ${formatFeePpm(500, "en")}: ${formatPercent(0.6, "en")} → ${formatPercent(0.3, "en")}`);
  });

  it("gives each moved range as prices then → now, both quoted the way the pair is at its price now", () => {
    const html = render(MOVED);
    const inverted = `${formatPrice(1 / 0.0005, "en")} – ${formatPrice(1 / 0.0003, "en")} USDC/WETH → ${formatPrice(1 / 0.0006, "en")} – ${formatPrice(1 / 0.0004, "en")} USDC/WETH`;
    const asIs = `${formatPrice(2800, "en")} – ${formatPrice(3200, "en")} USDT/WETH → ${formatPrice(3300, "en")} – ${formatPrice(3900, "en")} USDT/WETH`;

    expect(html).toContain(escaped(en.telegram.weeklyRanges));
    expect(items(html)).toContain(`USDC / WETH · ${formatFeePpm(500, "en")}: ${inverted}`);
    expect(items(html)).toContain(`WETH / USDT · ${formatFeePpm(3000, "en")}: ${asIs}`);
  });

  it("leaves out a part with nothing in it rather than a heading over nothing", () => {
    const html = render({ ...MOVED, digest: { ...DIGEST, gaining: [], ranges: [] }, topYields: [] });

    expect(html).not.toContain(escaped(en.telegram.weeklyGaining));
    expect(html).not.toContain(escaped(en.telegram.weeklyRanges));
    expect(html).not.toContain(escaped(copy.topHeading));
    expect(html).toContain(escaped(en.telegram.weeklyLosing));
  });

  it("says, in the bot's own words, that it is a measurement and not a suggestion", () => {
    expect(render(MOVED)).toContain(escaped(en.telegram.weeklyNote));
    expect(render(QUIET)).toContain(escaped(en.telegram.weeklyNote));
  });

  it("leads to the smart-money page on the same chain, the chain unsaid on mainnet as in every link", () => {
    expect(smartMoneyHref("tr", chainById(1))).toBe("/tr/smart-money");
    expect(smartMoneyHref("tr", chainById(8453))).toBe("/tr/smart-money?chain=base");
    expect(render(MOVED, 1, "tr")).toContain(`href="/tr/smart-money"`);
    expect(render(MOVED, 8453, "tr")).toContain(`href="/tr/smart-money?chain=base"`);
    expect(render(MOVED, 8453, "tr")).toContain(escaped(getWeeklyCopy("tr").detail));
  });

  it("says the bot sends this every Monday with /weekly, and links the bot, only where one is set up", () => {
    const withBot = render(MOVED, 1, "en", BOT);
    expect(withBot).toContain(escaped(copy.bot));
    expect(withBot).toContain("/weekly");
    expect(withBot).toContain('href="https://t.me/LiquidityWiseBot"');
    expect(withBot).toContain('rel="noopener noreferrer"');
    expect(withBot).toContain(getHomeAlertsCopy("en").telegramBot("LiquidityWiseBot"));

    const without = render(MOVED);
    expect(without).not.toContain(escaped(copy.bot));
    expect(without).not.toContain("t.me");
  });

  it("speaks the reader's language", () => {
    const html = render(MOVED, 8453, "de");
    const de = getDictionary("de");

    expect(html).toContain(escaped(getWeeklyCopy("de").intro("Base")));
    expect(html).toContain(escaped(de.telegram.weeklyGaining));
    expect(html).toContain(escaped(de.telegram.weeklyNote));
  });

  /*
   * A Latin pair and Latin-digit figures lay out left to right inside an
   * Arabic line, so the arrow between then and now has to point right there
   * too — as it does in the bot's message and on the smart-money page. The
   * one left-pointing arrow on the page is in the ranges' heading, which is
   * Arabic words alone.
   */
  it("points every arrow between figures right in Arabic too", () => {
    const html = render(MOVED, 1, "ar");
    const lines = items(html);

    expect(lines.length).toBeGreaterThan(4);
    for (const line of lines) expect(line, line).not.toContain("←");
    expect(lines).toContain(`WETH / USDT · ${formatFeePpm(3000, "ar")}: ${formatPercent(0.4, "ar")} → ${formatPercent(0.7, "ar")}`);
    expect(lines.some((line) => line.includes(`USDC/WETH → ${formatPrice(1 / 0.0006, "ar")}`))).toBe(true);
    expect(html).toContain(escaped(getWeeklyCopy("ar").window(formatUtcMinute(WINDOW.from), formatUtcMinute(WINDOW.to), formatWhole(7, "ar"))));
  });
});

describe("the digest by e-mail on the weekly page", () => {
  it("offers the form under the digest, with the page's chain chosen, wherever there is a week or will be one", () => {
    for (const reading of [MOVED, QUIET, NOT_YET, null]) {
      const html = render(reading, 8453, "en", null, { offered: true, status: null });

      expect(html).toContain('<section id="email"');
      expect(html).toContain('<option value="base" selected="">Base</option>');
      expect(html).toContain(getEmailDigestCopy("en").privacy);
    }
  });

  it("shows what the last submission came to, over the form", () => {
    expect(render(MOVED, 1, "en", null, { offered: true, status: "sent" })).toContain(getEmailDigestCopy("en").status.sent);
    expect(render(MOVED, 1, "en", null, { offered: true, status: null })).not.toContain('role="status"');
  });

  it("says the digest by e-mail is not set up where it is not, with no field to fill", () => {
    const html = render(MOVED, 1, "en", null, { offered: false, status: null });

    expect(html).toContain(getEmailDigestCopy("en").notConfigured);
    expect(html).not.toContain("<form");
  });

  it("offers nothing on a chain where no smart money is measured: there is no digest to send", () => {
    const html = render(null, 130, "en", null, { offered: true, status: null });

    expect(html).not.toContain('<section id="email"');
  });

  it("speaks the reader's language on the form too", () => {
    expect(render(MOVED, 1, "tr", null, { offered: true, status: null })).toContain(getEmailDigestCopy("tr").heading);
  });
});
