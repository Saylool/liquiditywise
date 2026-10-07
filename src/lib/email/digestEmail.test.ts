import { describe, expect, it } from "vitest";

import { getDictionary } from "../i18n/dictionaries";
import { getEmailDigestCopy } from "../i18n/emailDigestCopy";
import { LOCALES } from "../i18n/locales";
import { getWeeklyCopy } from "../i18n/weeklyCopy";
import { weeklyDigestText } from "../telegram/messages";
import type { WeeklyDigest } from "../telegram/weeklyDigest";
import { confirmationEmail, confirmUrl, digestEmail, escapeHtml, unsubscribeUrl, weeklyPageUrl } from "./digestEmail";
import { verifyToken } from "./signedToken";

const SECRET = "server-secret";
const ID = "abcDEF123456789012_-xy";
const NOW = new Date("2026-10-12T08:05:00.000Z");

/* The same digest messages.test.ts composes the bot's message from. */
const digest: WeeklyDigest = {
  days: 6.875,
  gaining: [{ pool: "0xb", pair: "WETH / USDT", feePpm: 3000, from: 0.4, to: 0.7 }],
  losing: [{ pool: "0xa", pair: "USDC / WETH", feePpm: 500, from: 0.6, to: 0.3 }],
  ranges: [{ pool: "0xa", pair: "USDC / WETH", feePpm: 500, then: [0.0003, 0.0005], now: [0.0004, 0.0006], currentPrice: 0.0005 }],
};

const mail = (locale: (typeof LOCALES)[number] = "en", chainId = 8453) =>
  digestEmail({
    digest,
    chainId,
    locale,
    t: getDictionary(locale),
    copy: getEmailDigestCopy(locale),
    weekly: getWeeklyCopy(locale),
    subscriptionId: ID,
    secret: SECRET,
  });

describe("the links a mail carries", () => {
  it("lead to the weekly page in the reader's language on the digest's chain, and to the two token pages", () => {
    expect(weeklyPageUrl("tr", 8453)).toBe("https://liquiditywise.com/tr/weekly?chain=base");
    expect(confirmUrl(SECRET, ID, NOW)).toMatch(/^https:\/\/liquiditywise\.com\/weekly\/confirm\?token=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(unsubscribeUrl(SECRET, ID)).toMatch(/^https:\/\/liquiditywise\.com\/weekly\/unsubscribe\?token=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("carry tokens that verify for their purpose: the confirmation until its moment, the unsubscribe for ever", () => {
    const confirm = new URL(confirmUrl(SECRET, ID, NOW)).searchParams.get("token");
    const stop = new URL(unsubscribeUrl(SECRET, ID)).searchParams.get("token");

    expect(verifyToken(SECRET, confirm, "confirm", new Date(NOW.getTime() - 1))).toEqual({ purpose: "confirm", id: ID, expiresAtMs: NOW.getTime() });
    expect(verifyToken(SECRET, confirm, "confirm", NOW)).toBeNull();
    expect(verifyToken(SECRET, stop, "unsubscribe", new Date("2031-01-01T00:00:00.000Z"))).toEqual({ purpose: "unsubscribe", id: ID, expiresAtMs: null });
    expect(verifyToken(SECRET, stop, "confirm", NOW)).toBeNull();
  });
});

describe("the digest mail", () => {
  it("is the bot's message as text, with the page and the way to stop it after", () => {
    const { text } = mail("en");
    const bot = weeklyDigestText(digest, getDictionary("en"), "en", 8453);
    const [message, footer] = [bot.slice(0, bot.lastIndexOf("\n\n")), bot.slice(bot.lastIndexOf("\n\n") + 2)];

    expect(text.startsWith(message)).toBe(true);
    expect(text).toContain(`${getEmailDigestCopy("en").mail.digestPage} https://liquiditywise.com/en/weekly?chain=base`);
    expect(text).toContain(footer);
    expect(text.endsWith(`${getEmailDigestCopy("en").mail.unsubscribeLink}: ${unsubscribeUrl(SECRET, ID)}`)).toBe(true);
  });

  it("is titled as the weekly page is, on the digest's chain", () => {
    expect(mail("en").subject).toBe(getWeeklyCopy("en").titleOn("Base"));
    expect(mail("de", 1).subject).toBe(getWeeklyCopy("de").titleOn("Ethereum"));
  });

  it("lays the same parts out as HTML: the heading, each list, the note, the links, the footer", () => {
    const { html } = mail("en");
    const en = getDictionary("en").telegram;

    expect(html).toContain("<h1");
    expect(html).toContain(escapeHtml("Smart liquidity · Base"));
    expect(html).toContain(`<h2 style="margin: 20px 0 6px; font-size: 16px; font-weight: 600;">${en.weeklyGaining}</h2>`);
    expect(html).toContain(`<h2 style="margin: 20px 0 6px; font-size: 16px; font-weight: 600;">${en.weeklyLosing}</h2>`);
    expect(html).toContain(`<h2 style="margin: 20px 0 6px; font-size: 16px; font-weight: 600;">${en.weeklyRanges}</h2>`);
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain(escapeHtml(en.weeklyNote));
    expect(html).toContain('href="https://liquiditywise.com/en/smart-money?chain=base"');
    expect(html).toContain('href="https://liquiditywise.com/en/weekly?chain=base"');
    expect(html).toContain(escapeHtml(en.footer));
    expect(html).toContain(`href="${escapeHtml(unsubscribeUrl(SECRET, ID))}"`);
  });

  it("leaves out a list with nothing in it, as the message does", () => {
    const { html, text } = digestEmail({
      digest: { ...digest, gaining: [], ranges: [] },
      chainId: 1,
      locale: "en",
      t: getDictionary("en"),
      copy: getEmailDigestCopy("en"),
      weekly: getWeeklyCopy("en"),
      subscriptionId: ID,
      secret: SECRET,
    });

    expect(html).not.toContain(getDictionary("en").telegram.weeklyGaining);
    expect(html).not.toContain(getDictionary("en").telegram.weeklyRanges);
    expect(text).not.toContain(getDictionary("en").telegram.weeklyGaining);
  });

  it("carries the one-click unsubscribe headers, pointing where the link in the body does", () => {
    expect(mail().headers).toEqual({
      "List-Unsubscribe": `<${unsubscribeUrl(SECRET, ID)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("escapes what a subgraph said a token is called", () => {
    const { html } = digestEmail({
      digest: { ...digest, gaining: [{ pool: "0xc", pair: '<img src=x onerror="x"> / "WETH"', feePpm: 3000, from: 0.1, to: 0.2 }] },
      chainId: 1,
      locale: "en",
      t: getDictionary("en"),
      copy: getEmailDigestCopy("en"),
      weekly: getWeeklyCopy("en"),
      subscriptionId: ID,
      secret: SECRET,
    });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;x&quot;&gt;");
  });

  it("is written in the reader's language and direction, with the site's colours in both schemes", () => {
    const arabic = mail("ar");

    expect(arabic.html).toContain('<html lang="ar" dir="rtl">');
    expect(mail("tr").html).toContain('<html lang="tr" dir="ltr">');
    expect(arabic.html).toContain('<meta name="color-scheme" content="light dark">');
    expect(arabic.html).toContain("@media (prefers-color-scheme: dark)");
    expect(arabic.html).toContain("#faf8fa");
    expect(arabic.html).toContain("#120f14");
    expect(arabic.text).toContain(getDictionary("ar").telegram.weeklyNote);
  });

  it("names nothing in a URL but the language, the chain and a token", () => {
    const { text, html } = mail();

    for (const url of `${text}\n${html}`.match(/https?:\/\/[^\s"<]+/g) ?? []) {
      expect(url).toMatch(/^https:\/\/liquiditywise\.com\/(en\/(weekly|smart-money)\?chain=base|weekly\/unsubscribe\?token=[A-Za-z0-9_.-]+)$/);
    }
  });
});

describe("the confirmation mail", () => {
  const confirmation = (locale: (typeof LOCALES)[number] = "en") =>
    confirmationEmail({ chainId: 8453, locale, copy: getEmailDigestCopy(locale), subscriptionId: ID, secret: SECRET, expiresAt: NOW });

  it("says who asked for what and where to confirm it, as text and as HTML, and what happens otherwise", () => {
    const { subject, text, html } = confirmation();
    const copy = getEmailDigestCopy("en");
    const href = confirmUrl(SECRET, ID, NOW);

    expect(subject).toBe(copy.mail.confirmSubject("Base"));
    expect(text).toContain(copy.mail.confirmIntro("Base"));
    expect(text).toContain(`${copy.mail.confirmLink}: ${href}`);
    expect(text).toContain(copy.mail.confirmIgnore);
    expect(html).toContain(`href="${escapeHtml(href)}"`);
    expect(html).toContain(escapeHtml(copy.mail.confirmIgnore));
    expect(html).toContain('class="button"');
  });

  it("carries no unsubscribe header: there is nothing yet to unsubscribe from", () => {
    expect(confirmation().headers).toBeUndefined();
  });

  it("speaks the reader's language", () => {
    expect(confirmation("pt").subject).toBe(getEmailDigestCopy("pt").mail.confirmSubject("Base"));
    expect(confirmation("ar").html).toContain('dir="rtl"');
  });
});

describe("escaping", () => {
  it("turns the five characters that can break markup into entities and leaves the rest", () => {
    expect(escapeHtml(`<a href="x">'&'</a> · →`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt; · →");
  });
});
