import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  type DataResult,
  HOOK_PERMISSION_FLAGS,
  type V4PoolSearchMatch,
  type V4PoolSearchResults as SearchResults,
} from "../schemas";
import { V4PoolSearchResults } from "./V4PoolSearchResults";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const POOL_ID = `0x${"e5".repeat(32)}`;
const SWAP_HOOK = `0x${"1".repeat(36)}${(HOOK_PERMISSION_FLAGS.BEFORE_SWAP | HOOK_PERMISSION_FLAGS.AFTER_SWAP).toString(16).padStart(4, "0")}`;
const LIQUIDITY_HOOK = `0x${"1".repeat(36)}${HOOK_PERMISSION_FLAGS.BEFORE_ADD_LIQUIDITY.toString(16).padStart(4, "0")}`;

/** USDC per WETH ≈ 2500 as Q64.96; `liquidity` scales the depth shown. */
const match = (
  overrides: Partial<V4PoolSearchMatch> & { hookAddress?: string | null; liquidity?: string } = {},
): V4PoolSearchMatch => ({
  pool: {
    protocolVersion: "v4",
    chainId: 1,
    id: POOL_ID,
    token0: { chainId: 1, address: USDC, symbol: "USDC", decimals: 6 },
    token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
    tickSpacing: 10,
    fee: { kind: "static", feePpm: 250 },
    hookAddress: overrides.hookAddress ?? null,
  },
  state: { liquidity: overrides.liquidity ?? "642953328768594464", sqrtPriceX96: "1584563250285286751870879006" },
  ethPrice: { token0: 0.0004, token1: 1 },
  exactSymbolMatches: 2,
  ...overrides,
});

const found = (matches: readonly V4PoolSearchMatch[]): DataResult<SearchResults> => ({
  status: "success",
  data: { terms: ["usdc", "weth"], fetchedAt: "2026-09-15T14:00:00.000Z", source: "uniswap-v4-subgraph", matches: [...matches] },
});

const render = (result: DataResult<SearchResults>, locale: Locale = "en", terms: readonly string[] = ["usdc", "weth"]) =>
  renderToStaticMarkup(
    <V4PoolSearchResults result={result} terms={terms} t={getDictionary(locale)} locale={locale} />,
  );

describe("V4PoolSearchResults", () => {
  it("shows the pair, the fee and the depth at the current price", () => {
    const markup = render(found([match()]));

    expect(markup).toContain("USDC / WETH");
    expect(markup).toContain("0.025%");
    expect(markup).toContain("Depth at the current price");
    expect(markup).toContain("ETH");
  });

  it("links each pool to its own v4 page, by id", () => {
    expect(render(found([match()]))).toContain(`href="/v4?id=${POOL_ID}"`);
  });

  it("says a pool is unread rather than empty when the chain would not answer", () => {
    const markup = render(found([match({ state: null })]));

    expect(markup).toContain("could not be read from the chain");
    expect(markup).not.toContain("Depth at the current price");
  });

  /* The word "holds" is the v3 list's, and it would be a false claim here. */
  it("never calls the depth what the pool holds", () => {
    expect(render(found([match()]))).not.toContain("Holds");
  });

  it("shows a dynamic fee as a state, not a number", () => {
    const dynamic = match({ hookAddress: SWAP_HOOK });
    const markup = render(found([{ ...dynamic, pool: { ...dynamic.pool, fee: { kind: "dynamic", currentFeePpm: null } } }]));

    expect(markup).toContain("Set by the hook, per swap");
  });

  describe("the hook", () => {
    it("says when there is none", () => {
      expect(render(found([match()]))).toContain("Hook none");
    });

    it("shows the hook's address in full", () => {
      expect(render(found([match({ hookAddress: SWAP_HOOK })]))).toContain(SWAP_HOOK);
    });

    /* Read from the address bits, and said on the list rather than the page after it. */
    it("warns on the row when the hook may change what a swap costs", () => {
      expect(render(found([match({ hookAddress: SWAP_HOOK })]))).toContain("may change what a swap costs");
    });

    it("does not warn for a hook that never runs on a swap", () => {
      expect(render(found([match({ hookAddress: LIQUIDITY_HOOK })]))).not.toContain("may change what a swap costs");
    });
  });

  it("shows every token's contract address, in full", () => {
    const markup = render(found([match()]));

    expect(markup).toContain(USDC);
    expect(markup).toContain(WETH);
  });

  it("says what the order means, and what it is not", () => {
    const markup = render(found([match()]));

    expect(markup).toContain("Pools named exactly what you searched for come first");
    expect(markup).toContain("Not what the pool holds");
  });

  it("marks no pool as trustworthy", () => {
    const markup = render(found([match()]));

    for (const claim of ["verified", "Verified", "official", "Official", "trusted", "safe"]) {
      expect(markup).not.toContain(claim);
    }
  });

  it("says plainly when a search matched nothing", () => {
    expect(render(found([]), "en", ["zzzz"])).toContain("No Ethereum mainnet Uniswap v4 pool has a currency matching zzzz.");
  });

  it("shows the sanitized message when the search itself failed", () => {
    const markup = render({ status: "unavailable", reason: "configuration-error", notice: "market-data-not-configured" });

    expect(markup).toContain("The search could not be run");
    expect(markup).not.toContain('href="/v4?id=');
  });

  describe("in Turkish", () => {
    const markup = render(found([match({ hookAddress: SWAP_HOOK })]), "tr");

    it("translates the labels and the warning", () => {
      expect(markup).toContain("Eşleşen Uniswap v4 havuzları");
      expect(markup).toContain("Güncel fiyattaki derinlik");
      expect(markup).toContain("bir takasın neye mal olduğunu değiştirebilir");
      expect(markup).toContain("%0,025");
    });
  });
});
