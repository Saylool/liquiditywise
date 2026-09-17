import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  type DataResult,
  HOOK_PERMISSION_FLAGS,
  type PairFeeTiers,
  type V4PairPool,
  type V4PairPools,
} from "../schemas";
import { V4PairPoolList, V4_PAIR_POOLS_SHOWN } from "./V4PairPoolList";
import { V4PairPanel } from "./V4PairPanel";
import { PoolFeeTiers } from "./PoolFeeTiers";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const NATIVE = `0x${"0".repeat(40)}`;
const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;
const SWAP_HOOK = `0x${"1".repeat(36)}${(HOOK_PERMISSION_FLAGS.BEFORE_SWAP | HOOK_PERMISSION_FLAGS.AFTER_SWAP).toString(16).padStart(4, "0")}`;
const SQRT_PRICE = "1584563250285286751870879006";

const entry = (index: number, liquidity: string, hookAddress: string | null = null, token0 = USDC): V4PairPool => ({
  pool: {
    protocolVersion: "v4",
    chainId: 1,
    id: poolId(index),
    token0: { chainId: 1, address: token0, symbol: token0 === NATIVE ? "ETH" : "USDC", decimals: token0 === NATIVE ? 18 : 6 },
    token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
    tickSpacing: 10,
    fee: { kind: "static", feePpm: 250 },
    protocolFee: null,
    hookAddress,
  },
  state: { liquidity, sqrtPriceX96: SQRT_PRICE },
  ethPrice: { token0: 0.0004, token1: 1 },
});

const found = (pools: readonly V4PairPool[], analysedPoolId: string | null = poolId(1)): DataResult<V4PairPools> => ({
  status: "success",
  data: { analysedPoolId, pools: [...pools], fetchedAt: "2026-09-15T12:00:00.000Z", sources: ["uniswap-v4-subgraph", "ethereum-rpc"] },
});

const render = (result: DataResult<V4PairPools>, locale: Locale = "en") =>
  renderToStaticMarkup(
    <V4PairPoolList result={result} pair="USDC / WETH" parameters={DEFAULT_PRICE_BAND_PARAMETERS} depositUsd={1_000} t={getDictionary(locale)} locale={locale} />,
  );

describe("V4PairPoolList", () => {
  it("shows each sibling's fee, price step, hook and depth", () => {
    const markup = render(found([entry(1, "20"), entry(2, "10", SWAP_HOOK)]));

    // The spacing as what it means: how finely a position's edges can be placed.
    expect(markup).toContain("0.025% · step 0.10%");
    expect(markup).not.toContain("spacing 10");
    expect(markup).toContain("Depth at the current price");
    expect(markup).toContain("no hook");
    expect(markup).toContain(`hook ${SWAP_HOOK} · may change what a swap costs`);
  });

  it("says when a sibling's fee was not read", () => {
    const unread = entry(2, "10");
    const markup = render(found([entry(1, "20"), { ...unread, pool: { ...unread.pool, fee: { kind: "unread" } } }]));

    expect(markup).toContain("fee not read · step 0.10%");
  });

  it("marks the pool being read and does not link it", () => {
    const markup = render(found([entry(1, "20"), entry(2, "10")]));

    expect(markup).toContain("You are reading this one");
    expect(markup).not.toContain(`href="/v4?id=${poolId(1)}`);
    expect(markup).toContain(`href="/v4?id=${poolId(2)}&amp;days=30&amp;sigma=1&amp;usd=1000"`);
  });

  it("links every pool when none is being read", () => {
    const markup = render(found([entry(1, "20"), entry(2, "10")], null));

    expect(markup).not.toContain("You are reading this one");
    expect(markup).toContain(`href="/v4?id=${poolId(1)}`);
  });

  /* The reader's own pool is shown whatever its depth: a list of siblings that left it out could not be checked. */
  it("cuts the list, keeps the pool being read, and counts the rest", () => {
    const many = Array.from({ length: V4_PAIR_POOLS_SHOWN + 5 }, (_u, index) => entry(index + 1, String(1000 - index)));
    const markup = render(found(many, poolId(V4_PAIR_POOLS_SHOWN + 5)));

    expect(markup).toContain("You are reading this one");
    expect(markup).toContain(`href="/v4?id=${poolId(1)}`);
    expect(markup).not.toContain(`href="/v4?id=${poolId(V4_PAIR_POOLS_SHOWN + 1)}`);
    expect(markup).toContain("4 more are not shown");
  });

  it("says what the order means, and that deeper is not better", () => {
    const markup = render(found([entry(1, "20"), entry(2, "10")]));

    expect(markup).toContain("Ordered by depth at the current price");
    expect(markup).toContain("nothing about which pool is better");
  });

  it("says when the pair trades at only this v4 pool", () => {
    expect(render(found([entry(1, "20")]))).toContain("trades at only this pool");
  });

  /* "Only this pool" is a claim about the reader's pool; beside a v3 page there is none, and one pool is a list. */
  it("lists a single v4 pool beside a v3 page rather than calling it the reader's own", () => {
    const markup = render(found([entry(1, "20")], null));

    expect(markup).not.toContain("trades at only this pool");
    expect(markup).toContain(`href="/v4?id=${poolId(1)}`);
  });

  it("says when no v4 pool trades the pair, which is a real answer beside a v3 page", () => {
    expect(render(found([], null))).toContain("No Uniswap v4 pool trades USDC / WETH with these two contracts");
  });

  it("shows the sanitized message when the read failed", () => {
    const markup = render({ status: "unavailable", reason: "configuration-error", notice: "market-data-not-configured" });

    // React escapes the apostrophe, so the assertion sits after it.
    expect(markup).toContain("v4 pools could not be read");
    expect(markup).not.toContain('href="/v4?id=');
  });

  it("translates", () => {
    const markup = render(found([entry(1, "20"), entry(2, "10")]), "tr");

    expect(markup).toContain("Güncel fiyattaki derinlik");
    expect(markup).toContain("%0,025 · adım %0,10");
    expect(markup).toContain("Şu an bunu okuyorsun");
  });
});

const v3Tiers = (analysedPoolId: string | null): DataResult<PairFeeTiers> => ({
  status: "success",
  data: {
    analysedPoolId,
    tiers: [
      {
        pool: { protocolVersion: "v3", chainId: 1, id: `0x${"5".repeat(40)}`, token0: { chainId: 1, address: USDC, symbol: "USDC", decimals: 6 }, token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 }, feePpm: 500 },
        reserves: null,
      },
      {
        pool: { protocolVersion: "v3", chainId: 1, id: `0x${"3".repeat(40)}`, token0: { chainId: 1, address: USDC, symbol: "USDC", decimals: 6 }, token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 }, feePpm: 3000 },
        reserves: null,
      },
    ],
    fetchedAt: "2026-09-15T12:00:00.000Z",
    sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
  },
});

describe("V4PairPanel", () => {
  const renderPanel = (v3Result: DataResult<PairFeeTiers> | null, token0Address = USDC) =>
    renderToStaticMarkup(
      <V4PairPanel
        v4Result={found([entry(1, "20"), entry(2, "10")])}
        v3Result={v3Result}
        pair="USDC / WETH"
        token0Address={token0Address}
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        depositUsd={1_000}
        t={getDictionary("en")}
        locale="en"
      />,
    );

  it("shows the v4 siblings and then the same pair on v3, all linked", () => {
    const markup = renderPanel(v3Tiers(null));

    expect(markup).toContain("On Uniswap v4");
    expect(markup).toContain("On Uniswap v3");
    expect(markup).toContain("The v3 pools that trade USDC / WETH");
    expect(markup).toContain(`href="/pool?address=0x${"5".repeat(40)}`);
    expect(markup).toContain(`href="/pool?address=0x${"3".repeat(40)}`);
  });

  /* Ether is not a token; the question has no v3 form, and the panel says why. */
  it("says why a native-ether pair has no v3 list", () => {
    const markup = renderPanel(null, NATIVE);

    expect(markup).toContain("v3 cannot");
    expect(markup).not.toContain('href="/pool?address=');
  });

  /* The panel's own guarantee, not the section's: a native pair gets no v3 list even if one was handed over. */
  it("refuses to show a v3 list for a native-ether pair whatever it was given", () => {
    const markup = renderPanel(v3Tiers(null), NATIVE);

    expect(markup).toContain("v3 cannot");
    expect(markup).not.toContain('href="/pool?address=');
  });
});

describe("PoolFeeTiers with the v4 list beneath", () => {
  it("lists the same contracts on v4 under the v3 tiers", () => {
    const markup = renderToStaticMarkup(
      <PoolFeeTiers
        result={v3Tiers(`0x${"5".repeat(40)}`)}
        v4Result={found([entry(1, "20"), entry(2, "10")], null)}
        pair="USDC / WETH"
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        depositUsd={1_000}
        t={getDictionary("en")}
        locale="en"
      />,
    );

    expect(markup).toContain("You are reading this one");
    expect(markup).toContain("On Uniswap v4");
    expect(markup).toContain(`href="/v4?id=${poolId(1)}`);
    expect(markup).toContain("the same two contracts");
  });
});
