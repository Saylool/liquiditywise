import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  type DataResult,
  type PoolSearchMatch,
  type PoolSearchResults as SearchResults,
} from "../schemas";
import { PoolSearchResults } from "./PoolSearchResults";

/*
 * Rendered through `react-dom/server`, which needs no DOM and no browser.
 */

const REAL_USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const FAKE_USDC = "0xdeadbeef00000000000000000000000000000001";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

/** `heldWeth` is whole WETH the pool holds; the figure the row now shows. */
const match = (
  poolId: string,
  token0Address: string,
  heldWeth: number,
  exactSymbolMatches = 2,
): PoolSearchMatch => ({
  pool: {
    protocolVersion: "v3",
    chainId: 1,
    id: poolId,
    token0: { chainId: 1, address: token0Address, symbol: "USDC", decimals: 6 },
    token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
    feePpm: 500,
  },
  reserves: { token0: "1000000", token1: `${BigInt(heldWeth) * 10n ** 18n}` },
  ethPrice: { token0: 0.0004, token1: 1 },
  exactSymbolMatches,
});

const found = (matches: readonly PoolSearchMatch[]): DataResult<SearchResults> => ({
  status: "success",
  data: {
    terms: ["usdc", "weth"],
    fetchedAt: "2026-09-14T11:34:00.000Z",
    source: "uniswap-v3-subgraph",
    matches: [...matches],
  },
});

const render = (
  result: DataResult<SearchResults>,
  locale: Locale = "en",
  terms: readonly string[] = ["usdc", "weth"],
) =>
  renderToStaticMarkup(
    <PoolSearchResults result={result} terms={terms} t={getDictionary(locale)} locale={locale} />,
  );

const REAL_POOL = `0x${"1".repeat(40)}`;
const FAKE_POOL = `0x${"2".repeat(40)}`;

describe("PoolSearchResults", () => {
  /*
   * The row used to show the dollar figure the indexer reports. It now shows the
   * balances the token contracts report, because the indexer's figure was wrong
   * by up to a thousand times and it decided this list's order.
   */
  it("shows the pair, the fee tier and what the pool actually holds", () => {
    const markup = render(found([match(REAL_POOL, REAL_USDC, 415_947_071)]));

    expect(markup).toContain("USDC / WETH");
    expect(markup).toContain("0.05%");
    expect(markup).toContain("415,947,071 WETH");
    expect(markup).not.toContain("$415,947,071");
  });

  it("says a pool is unread rather than empty when the chain would not answer", () => {
    const unread = match(REAL_POOL, REAL_USDC, 1);
    const markup = render(found([{ ...unread, reserves: null, ethPrice: null }]));

    expect(markup).toContain("could not be read from the chain");
    expect(markup).not.toContain("Holds");
  });

  it("links each pool to its own analysis", () => {
    const markup = render(found([match(REAL_POOL, REAL_USDC, 1)]));

    expect(markup).toContain(`href="/pool?address=${REAL_POOL}"`);
  });

  /*
   * The point of the page. Two pools whose symbols read identically are told
   * apart by their token contracts and by nothing else, so both addresses are
   * shown in full — a truncated one is exactly what a lookalike hides behind.
   */
  it("shows every token's contract address, in full", () => {
    const markup = render(
      found([match(REAL_POOL, REAL_USDC, 415_947_071), match(FAKE_POOL, FAKE_USDC, 12)]),
    );

    expect(markup).toContain(REAL_USDC);
    expect(markup).toContain(FAKE_USDC);
    expect(markup).toContain(WETH);
    // Not an ellipsis in sight where an address should be.
    expect(markup).not.toContain(`${REAL_USDC.slice(0, 6)}…`);
  });

  it("warns that a symbol is whatever its contract says", () => {
    const markup = render(found([match(REAL_POOL, REAL_USDC, 1)]));

    expect(markup).toContain("deploying a token that calls itself USDC costs nothing");
  });

  it("says what the order means, because the order is a claim", () => {
    const markup = render(found([match(REAL_POOL, REAL_USDC, 1)]));

    expect(markup).toContain("Pools named exactly what you searched for come first");
  });

  /*
   * No badge, no tick, no "official". This application cannot tell which USDC is
   * the real one, and a mark implying otherwise would be worse than none.
   */
  it("marks no pool as trustworthy", () => {
    const markup = render(found([match(REAL_POOL, REAL_USDC, 415_947_071)]));

    for (const claim of ["verified", "Verified", "official", "Official", "trusted", "safe"]) {
      expect(markup).not.toContain(claim);
    }
  });

  it("says plainly when a search matched nothing", () => {
    const markup = render(found([]), "en", ["zzzz"]);

    expect(markup).toContain("No Uniswap v3 pool on Ethereum mainnet has a token matching zzzz.");
    expect(markup).toContain("Check the spelling");
  });

  it("names the chain it searched when nothing matched there", () => {
    const markup = renderToStaticMarkup(
      <PoolSearchResults result={found([])} terms={["zzzz"]} chainId={8453} t={getDictionary("tr")} locale="tr" />,
    );

    expect(markup).toContain("zzzz ile eşleşen tokenı olan bir Uniswap v3 havuzu bulunamadı (Base).");
  });

  it("links a pool found off mainnet on its own chain", () => {
    const onBase = found([{ ...match(REAL_POOL, REAL_USDC, 1), pool: { ...match(REAL_POOL, REAL_USDC, 1).pool, chainId: 8453 } }]);

    expect(render(onBase)).toContain(`/pool?chain=base&amp;address=${REAL_POOL}`);
    expect(render(found([match(REAL_POOL, REAL_USDC, 1)]))).toContain(`href="/pool?address=${REAL_POOL}"`);
  });

  it("names both terms in the sentence about what was searched", () => {
    expect(render(found([match(REAL_POOL, REAL_USDC, 1)]))).toContain("usdc / weth");
  });

  it("shows the sanitized message when the search itself failed", () => {
    const markup = render({
      status: "unavailable",
      reason: "rate-limited",
      notice: "market-data-rate-limited",
    });

    expect(markup).toContain("The search could not be run");
    expect(markup).toContain("rate limit was exceeded");
  });

  it("renders no pool list when the search failed", () => {
    const markup = render({
      status: "unavailable",
      reason: "network-error",
      notice: "market-data-unreachable",
    });

    expect(markup).not.toContain("href=\"/pool?address=");
  });

  describe("in Turkish", () => {
    const markup = render(found([match(REAL_POOL, REAL_USDC, 415_947_071)]), "tr");

    it("translates the labels", () => {
      expect(markup).toContain("Eşleşen Uniswap v3 havuzları");
      expect(markup).toContain("Komisyon kademesi");
      expect(markup).toContain("Tuttuğu");
      expect(markup).not.toContain("Matching Uniswap v3 pools");
    });

    it("writes the numbers the way Turkish writes them", () => {
      expect(markup).toContain("%0,05");
    });

    it("keeps the warning, which is the part that matters most", () => {
      expect(markup).toContain("kendine USDC diyen bir token çıkarmanın hiçbir maliyeti yoktur");
    });

    it("leaves the pool's own symbols and addresses untouched", () => {
      expect(markup).toContain("USDC / WETH");
      expect(markup).toContain(REAL_USDC);
    });
  });
});
