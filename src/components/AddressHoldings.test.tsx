import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { AddressHoldings as Holdings, DataResult } from "../schemas";
import { AddressHoldings } from "./AddressHoldings";

const ADDRESS = `0x${"a".repeat(40)}`;
const token = (address: string, symbol: string, decimals: number) => ({
  chainId: 1,
  address,
  symbol,
  decimals,
});

const USDC = token(`0x${"1".repeat(40)}`, "USDC", 6);
const WETH = token(`0x${"b".repeat(40)}`, "WETH", 18);

const pool = (id: string, feePpm: number) => ({
  protocolVersion: "v3" as const,
  chainId: 1,
  id,
  token0: USDC,
  token1: WETH,
  feePpm,
});

const holdings = (overrides: Partial<Holdings> = {}): DataResult<Holdings> => ({
  status: "success",
  data: {
    address: ADDRESS,
    tokensChecked: 175,
    holdings: [
      { token: USDC, amount: "76083329855300" },
      { token: WETH, amount: "11833787000000000000000" },
    ],
    pools: [
      { pool: pool(`0x${"5".repeat(40)}`, 500), heldSides: "both" },
      { pool: pool(`0x${"3".repeat(40)}`, 3000), heldSides: "token0" },
    ],
    fetchedAt: "2026-09-15T12:00:00.000Z",
    sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
    ...overrides,
  } as Holdings,
});

const render = (result: DataResult<Holdings>, locale: Locale = "en") =>
  renderToStaticMarkup(
    <AddressHoldings
      result={result}
      poolsSearched={250}
      parameters={DEFAULT_PRICE_BAND_PARAMETERS}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

describe("AddressHoldings", () => {
  it("shows each balance in the token's own units", () => {
    const markup = render(holdings());

    expect(markup).toContain("76,083,329.8553");
    expect(markup).toContain("11,833.787");
  });

  it("shows the address in full", () => {
    expect(render(holdings())).toContain(ADDRESS);
  });

  it("separates the pools you can enter now from the ones needing a swap", () => {
    const markup = render(holdings());

    expect(markup).toContain("You hold both sides");
    expect(markup).toContain("You hold one side");
  });

  /*
   * The sentence that keeps the answer honest. Nothing can enumerate an
   * address's tokens, so the width of the search is part of the answer rather
   * than a footnote — and "nothing found" must never read as "your wallet is
   * empty".
   */
  it("says how wide the search was", () => {
    const markup = render(holdings());

    expect(markup).toContain("This asked 175 of them");
    expect(markup).toContain("250 most-traded pools");
  });

  it("says an empty result is an empty search, not an empty wallet", () => {
    const markup = render(holdings({ holdings: [], pools: [] }));

    expect(markup).toContain("That is not the same as an empty wallet");
    expect(markup).not.toContain("You hold both sides");
  });

  it("carries the band parameters into every pool link", () => {
    expect(render(holdings())).toContain("days=30&amp;sigma=1");
  });

  it("names the ordering when it cuts the one-sided list", () => {
    const many = Array.from({ length: 30 }, (_unused, index) => ({
      pool: pool(`0x${index.toString(16).padStart(40, "0")}`, 3000),
      heldSides: "token0" as const,
    }));
    const markup = render(holdings({ pools: many }));

    expect(markup).toContain("18 more are not shown");
    expect(markup).toContain("most traded of them");
  });

  it("renders a failed read as a failure, not as an empty address", () => {
    const markup = render({
      status: "unavailable",
      reason: "rate-limited",
      notice: "chain-data-rate-limited",
    });

    expect(markup).toContain("This address could not be read");
    expect(markup).not.toContain("Tokens found");
  });

  it("says it in Turkish too", () => {
    const markup = render(holdings(), "tr");

    expect(markup).toContain("İki tarafı da tutuyorsun");
    expect(markup).toContain("76.083.329,8553");
  });
});
