import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getSmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import { HomeAlerts } from "./HomeAlerts";

const BOT = { username: "LiquidityWiseBot", url: "https://t.me/LiquidityWiseBot" };

describe("the front page's alerts section", () => {
  it("leads to the smart-money page in the reader's language, with that page's own words", () => {
    const html = renderToStaticMarkup(<HomeAlerts locale="tr" bot={null} />);

    expect(html).toContain('href="/tr/smart-money"');
    expect(html).toContain(getSmartLiquidityCopy("tr").link);
    expect(html).toContain("Paranın nereye gittiğini gör");
  });

  it("shows the bot where alerts are set up: the way to choose an address, and the bot's own link", () => {
    const html = renderToStaticMarkup(<HomeAlerts locale="en" bot={BOT} />);

    expect(html).toContain("Alerts on Telegram");
    expect(html).toContain('href="/holdings"');
    expect(html).toContain('href="https://t.me/LiquidityWiseBot"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Open the bot: @LiquidityWiseBot");
    expect(html).toContain("/smart");
  });

  it("says nothing of a bot where none is set up, rather than pointing at one that cannot answer", () => {
    const html = renderToStaticMarkup(<HomeAlerts locale="en" bot={null} />);

    expect(html).not.toContain("Telegram");
    expect(html).not.toContain("t.me");
    expect(html).not.toContain("/holdings");
  });
});
