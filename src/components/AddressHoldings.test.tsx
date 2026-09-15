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
    poolsSearched: { v3: 250, v4: 250 },
    fetchedAt: "2026-09-15T12:00:00.000Z",
    sources: ["uniswap-v3-subgraph", "uniswap-v4-subgraph", "ethereum-rpc"],
    ...overrides,
  } as Holdings,
});

const render = (result: DataResult<Holdings>, locale: Locale = "en") =>
  renderToStaticMarkup(
    <AddressHoldings
      result={result}
      parameters={DEFAULT_PRICE_BAND_PARAMETERS}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

/** v4's native ether: the zero address, which is a currency and not a missing field. */
const NATIVE = `0x${"0".repeat(40)}`;
const ETH = token(NATIVE, "ETH", 18);
const SWAP_HOOK = `0x${"1".repeat(36)}00c4`;

const v4Pool = (id: string, hookAddress: string | null = null) => ({
  protocolVersion: "v4" as const,
  chainId: 1,
  id,
  token0: ETH,
  token1: USDC,
  tickSpacing: 10,
  fee: { kind: "static" as const, feePpm: 625 },
  hookAddress,
});

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
    expect(markup).toContain("250 most-traded Uniswap v3 pools");
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

/*
 * The v4 half of the page: pools of the other protocol in the same two groups,
 * each linked to its own page, and the chain's own ether as a holding.
 */
describe("AddressHoldings with v4 pools", () => {
  const V4_ID = `0x${"e5".repeat(32)}`;

  it("links a v4 pool to the v4 page by id, carrying the band", () => {
    const markup = render(
      holdings({
        holdings: [{ token: ETH, amount: "1000000000000000000" }, { token: USDC, amount: "5000000" }],
        pools: [{ pool: v4Pool(V4_ID), heldSides: "both" }],
      }),
    );

    expect(markup).toContain(`href="/v4?id=${V4_ID}&amp;days=30&amp;sigma=1"`);
    expect(markup).toContain("ETH / USDC");
  });

  it("names the protocol on every row", () => {
    const markup = render(
      holdings({
        holdings: [{ token: ETH, amount: "1" }, { token: USDC, amount: "1" }],
        pools: [
          { pool: pool(`0x${"5".repeat(40)}`, 500), heldSides: "token0" },
          { pool: v4Pool(V4_ID), heldSides: "both" },
        ],
      }),
    );

    expect(markup).toContain("v3 · 0.05%");
    expect(markup).toContain("v4 · 0.0625%");
  });

  it("marks a hooked pool on the row", () => {
    const markup = render(
      holdings({
        holdings: [{ token: ETH, amount: "1" }],
        pools: [{ pool: v4Pool(V4_ID, SWAP_HOOK), heldSides: "token0" }],
      }),
    );

    expect(markup).toContain("v4 · 0.0625% · hook");
  });

  it("does not mark a pool with no hook", () => {
    const markup = render(
      holdings({
        holdings: [{ token: ETH, amount: "1" }],
        pools: [{ pool: v4Pool(V4_ID), heldSides: "token0" }],
      }),
    );

    expect(markup).not.toContain("· hook");
  });

  it("lists the chain's own ether among the holdings", () => {
    const markup = render(holdings({ holdings: [{ token: ETH, amount: "2500000000000000000" }], pools: [] }));

    expect(markup).toContain("ETH");
    expect(markup).toContain("2.5");
  });

  it("says both nets were cast, ether among the currencies", () => {
    const markup = render(holdings());

    expect(markup).toContain("250 most-traded Uniswap v3 pools");
    expect(markup).toContain("250 most-traded v4 pools");
    expect(markup).not.toContain("were not searched");
  });

  /* A v3-only list must not read as "no v4 pool takes what you hold". */
  it("says out loud when the v4 net was not cast", () => {
    const markup = render(
      holdings({
        poolsSearched: { v3: 250, v4: null },
        sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
      }),
    );

    expect(markup).toContain("Uniswap v4 pools were not searched");
    expect(markup).not.toContain("most-traded v4 pools");
  });

  it("says so in Turkish too", () => {
    const markup = render(
      holdings({
        poolsSearched: { v3: 250, v4: null },
        sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
      }),
      "tr",
    );

    expect(markup).toContain("Uniswap v4 havuzları aranmadı");
  });
});
