import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getPairPoolsCopy } from "../lib/i18n/pairPoolsCopy";
import { getSmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import { getEmailDigestCopy } from "../lib/i18n/emailDigestCopy";
import { getWeeklyCopy } from "../lib/i18n/weeklyCopy";
import { HomeAlerts } from "./HomeAlerts";

const BOT = { username: "LiquidityWiseBot", url: "https://t.me/LiquidityWiseBot" };

describe("the front page's alerts section", () => {
  it("leads to the smart-money page in the reader's language, with that page's own words", () => {
    const html = renderToStaticMarkup(<HomeAlerts locale="tr" bot={null} emailDigest={false} />);

    expect(html).toContain('href="/tr/smart-money"');
    expect(html).toContain(getSmartLiquidityCopy("tr").link);
    expect(html).toContain("Paranın nereye gittiğini gör");
  });

  it("leads on to the week's digest beside it, in the reader's language and by that page's own name", () => {
    const html = renderToStaticMarkup(<HomeAlerts locale="tr" bot={null} emailDigest={false} />);

    expect(html).toContain('href="/tr/weekly"');
    expect(html).toContain(getWeeklyCopy("tr").link);
  });

  it("leads to the pair page, which has no language address, with its own heading in the reader's language, with or without a bot", () => {
    for (const bot of [null, BOT]) {
      const html = renderToStaticMarkup(<HomeAlerts locale="tr" bot={bot} emailDigest={false} />);

      expect(html).toContain('href="/pair"');
      expect(html).toContain(getPairPoolsCopy("tr").heading);
      expect(html).toContain("Bir parite ara");
    }
  });

  it("lays the cards out three across only when there are three: with the bot's card or the e-mail card, not both or neither", () => {
    expect(renderToStaticMarkup(<HomeAlerts locale="en" bot={BOT} emailDigest={false} />)).toContain("lg:grid-cols-3");
    expect(renderToStaticMarkup(<HomeAlerts locale="en" bot={null} emailDigest />)).toContain("lg:grid-cols-3");
    expect(renderToStaticMarkup(<HomeAlerts locale="en" bot={BOT} emailDigest />)).not.toContain("lg:grid-cols-3");
    expect(renderToStaticMarkup(<HomeAlerts locale="en" bot={null} emailDigest={false} />)).not.toContain("lg:grid-cols-3");
  });

  it("shows the bot where alerts are set up: the way to choose an address, and the bot's own link", () => {
    const html = renderToStaticMarkup(<HomeAlerts locale="en" bot={BOT} emailDigest={false} />);

    expect(html).toContain("Alerts on Telegram");
    expect(html).toContain('href="/holdings"');
    expect(html).toContain('href="https://t.me/LiquidityWiseBot"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Open the bot: @LiquidityWiseBot");
    expect(html).toContain("/smart");
    expect(html).toContain("/weekly");
  });

  it("says nothing of a bot where none is set up, rather than pointing at one that cannot answer", () => {
    const html = renderToStaticMarkup(<HomeAlerts locale="en" bot={null} emailDigest={false} />);

    expect(html).not.toContain("Telegram");
    expect(html).not.toContain("t.me");
    expect(html).not.toContain("/holdings");
  });

  /* The card names no bot: it stands where there may be none (emailDigestCopy.test.ts holds its words to that). */
  it("leads to the form for the digest by e-mail where it is set up, in the reader's language, and says nothing of it where it is not", () => {
    const html = renderToStaticMarkup(<HomeAlerts locale="tr" bot={null} emailDigest />);

    expect(html).toContain(getEmailDigestCopy("tr").heading);
    expect(html).toContain(getEmailDigestCopy("tr").homeCta);
    expect(html).toContain('href="/tr/weekly#email"');
    expect(html).not.toContain("Telegram");

    const without = renderToStaticMarkup(<HomeAlerts locale="tr" bot={null} emailDigest={false} />);
    expect(without).not.toContain(getEmailDigestCopy("tr").heading);
    expect(without).not.toContain("#email");
  });
});
