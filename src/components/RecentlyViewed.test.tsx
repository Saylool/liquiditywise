import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import { getInterfaceCopy } from "../lib/i18n/interface";
import type { Locale } from "../lib/i18n/locales";
import { getRecentCopy } from "../lib/i18n/recentCopy";
import type { RecentlyViewed as Recent } from "../lib/recent/recentlyViewed";
import { findElement } from "../lib/testing/reactTree";
import { RecentlyViewed, RecentlyViewedList, type RecentWords } from "./RecentlyViewed";
import { RememberVisit } from "./RememberVisit";

const V3 = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const V4 = "0x21c67e77068de97969ba93d4aab21826d33ca12bb9f565d8496e8fda8a82ca27";
const OWNER = "0x1111111111111111111111111111111111111111";

const words = (locale: Locale): RecentWords => ({
  mainnet: getInterfaceCopy(locale).chain,
  dynamicFee: getDictionary(locale).v4.dynamicFee,
});

const RECENT: Recent = {
  pools: [
    { protocol: "v4", chain: "base", id: V4, pair: "ETH / USDC", feePpm: null, at: Date.UTC(2026, 9, 6) },
    { protocol: "v3", chain: "ethereum", id: V3, pair: "USDC / WETH", feePpm: 500, at: Date.UTC(2026, 9, 5) },
  ],
  addresses: [{ chain: "arbitrum", address: OWNER, at: Date.UTC(2026, 9, 4) }],
};

const render = (recent: Recent, placement: "home" | "lookup" = "home", locale: Locale = "en") =>
  renderToStaticMarkup(<RecentlyViewedList recent={recent} locale={locale} placement={placement} words={words(locale)} onForget={() => {}} />);

describe("the list of what was last looked at", () => {
  /*
   * The page the server sends must be the same for every reader — it is
   * cached as such, and nothing about a reader is on the server to put in it.
   */
  it("renders nothing on the server, whatever a browser may hold", () => {
    expect(renderToStaticMarkup(<RecentlyViewed locale="en" placement="home" words={words("en")} />)).toBe("");
  });

  it("links each pool to its own page, with mainnet unsaid, and never prefetches", () => {
    const html = render(RECENT);

    expect(html).toContain(`href="/v4?chain=base&amp;id=${V4}"`);
    expect(html).toContain(`href="/pool?address=${V3}"`);
    expect(html).toContain(`href="/holdings?chain=arbitrum&amp;address=${OWNER}"`);
    expect(html).not.toContain("prefetch");
  });

  it("writes each pool as pair, fee tier and network, in the reader's language", () => {
    const html = render(RECENT, "home", "tr");

    expect(html).toContain("USDC / WETH");
    expect(html).toContain("0,05");
    expect(html).toContain(getInterfaceCopy("tr").chain);
    expect(html).toContain("ETH / USDC");
    expect(html).toContain(getDictionary("tr").v4.dynamicFee);
    expect(html).toContain("Base");
  });

  it("writes an address short, with its network, and no fee", () => {
    const html = render({ pools: [], addresses: RECENT.addresses });

    expect(html).toContain('<span class="recent-label">0x1111…1111</span>');
    expect(html).toContain("Arbitrum One");
    /* The whole address is in the link alone, where it belongs. */
    expect(html.split(OWNER)).toHaveLength(2);
    expect((html.match(/·/g) ?? []).length).toBe(1);
  });

  it("says when each was opened, as a date the machine can read too", () => {
    const html = render(RECENT);

    expect(html).toContain('dateTime="2026-10-06T00:00:00.000Z"');
    expect(html).toMatch(/Oct 6, 2026|6 Oct 2026/);
  });

  it("has the front page's heading and the sentence saying where the list is, at home", () => {
    const html = render(RECENT, "home", "tr");
    const copy = getRecentCopy("tr");

    expect(html).toContain(copy.heading);
    expect(html).toContain(copy.note("5", "2"));
    expect(html).toContain("Yalnızca bu tarayıcıda tutulur");
  });

  it("has only the one word beside the pool box, and no sentence", () => {
    const html = render(RECENT, "lookup", "tr");
    const copy = getRecentCopy("tr");

    expect(html).toContain(copy.recently);
    expect(html).not.toContain(copy.heading);
    expect(html).not.toContain("Yalnızca bu tarayıcıda");
  });

  it("offers the forget control in the reader's language, wired to what it is given", () => {
    const onForget = vi.fn();
    const tree = RecentlyViewedList({ recent: RECENT, locale: "tr", placement: "home", words: words("tr"), onForget });
    const button = findElement(tree, "button");

    expect(button).not.toBeNull();
    expect(button?.type).toBe("button");
    expect(button?.children).toBe(getRecentCopy("tr").forget);
    (button?.onClick as () => void)();
    expect(onForget).toHaveBeenCalledTimes(1);
  });

  it("is given only strings from the dictionary, so it can cross the server boundary", () => {
    expect(Object.values(words("en")).every((value) => typeof value === "string")).toBe(true);
  });

  it("wraps rather than fixing a width, so a long pair at 375px breaks a line instead of being clipped", () => {
    const html = render(RECENT);

    expect(html).toContain('class="recent-list"');
    expect(html).not.toMatch(/style="/);
    expect(html).not.toMatch(/whitespace-nowrap|nowrap/);
  });
});

describe("the component that remembers a page", () => {
  it("draws nothing: recording is an effect of the page having been shown, not a thing on it", () => {
    const html = renderToStaticMarkup(
      <RememberVisit visit={{ kind: "pool", pool: { protocol: "v3", chain: "ethereum", id: V3, pair: "USDC / WETH", feePpm: 500 } }} />,
    );

    expect(html).toBe("");
  });
});
