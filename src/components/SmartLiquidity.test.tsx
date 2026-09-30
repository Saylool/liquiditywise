import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SmartLiquidityRead } from "../lib/advisor/readSmartLiquidity";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import type { MeasuredPosition } from "../lib/analytics/smartLiquidity";
import { chainById, ETHEREUM, V3_POSITION_CHAINS } from "../lib/chains/chains";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { getSmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import type { V3PoolMetadata } from "../schemas";
import { rangeAround, SMART_POSITIONS_SHOWN, SmartLiquidity } from "./SmartLiquidity";

const POOL: V3PoolMetadata = {
  protocolVersion: "v3",
  chainId: 1,
  id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
  feePpm: 500,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
};
const OWNER = `0x${"d".repeat(40)}`;
/** 2,500 USDC per WETH, as token0 in token1: 0.0004 WETH per USDC. */
const PRICE = 0.0004;

const smartPosition = (tokenId: string): MeasuredPosition => ({
  pool: POOL,
  tokenId,
  owner: OWNER,
  valueUsd: 50_000,
  feesUsd: 400,
  days: 8.6,
  yearlyYield: 0.34,
  lowerPrice: PRICE * 0.95,
  upperPrice: PRICE * 1.02,
  currentPrice: PRICE,
});

const measured = (smart: readonly MeasuredPosition[], poolsRead = 12): SmartLiquidityRead => ({
  status: "measured",
  poolsAsked: 12,
  poolsRead,
  measuredAt: "2026-09-30T12:00:00.000Z",
  data: {
    measured: 95,
    medianYearlyYield: 0.1,
    smartFrom: 0.2,
    smart,
    pairs:
      smart.length === 0
        ? []
        : [
            {
              pool: POOL,
              positions: smart.length,
              valueUsd: 50_000 * smart.length,
              medianLowerRatio: 0.95,
              medianUpperRatio: 1.02,
              medianYearlyYield: 0.34,
              currentPrice: PRICE,
            },
          ],
  },
});

const render = (read: SmartLiquidityRead | null, chainId = 1, locale: Locale = "en") =>
  renderToStaticMarkup(
    <SmartLiquidity
      read={read}
      chain={chainById(chainId as 1)}
      chains={V3_POSITION_CHAINS}
      pageHref="/smart-money"
      networkLabel="Network"
      copy={getSmartLiquidityCopy(locale)}
      parameters={DEFAULT_PRICE_BAND_PARAMETERS}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

describe("a range around the price", () => {
  it("is written in the direction the pair is quoted: WETH in USDC, so the edges swap and invert", () => {
    const { below, above } = rangeAround(POOL, PRICE, 0.95, 1.02);

    expect(below).toBeCloseTo(1 / 1.02 - 1, 12);
    expect(above).toBeCloseTo(1 / 0.95 - 1, 12);
  });

  it("stays as it is for a pair already quoted token0 in token1", () => {
    expect(rangeAround(POOL, 2_500, 0.95, 1.02)).toEqual({ below: 0.95 - 1, above: 1.02 - 1 });
  });
});

describe("the smart-money page", () => {
  it("shows the pairs, their typical range and yield, then the positions with who holds them", () => {
    const html = render(measured([smartPosition("1"), smartPosition("2")]));

    expect(html).toContain("Where they are");
    expect(html).toContain("USDC / WETH · 0.05%");
    expect(html).toContain("Smart positions: 2");
    expect(html).toContain("Range: -1.96% to +5.26% around the price");
    expect(html).toContain("-1.96% to +5.26% around the price");
    expect(html).toContain("34.00% a year");
    expect(html).toContain(OWNER);
    expect(html).toContain(`href="/holdings?address=${OWNER}"`);
    expect(html).toContain(`href="/pool?address=${POOL.id}`);
    expect(html).toContain("95 positions measured");
  });

  it("links an owner to their positions on the same chain", () => {
    const polygonPool = { ...POOL, chainId: 137 };
    const read = measured([{ ...smartPosition("1"), pool: polygonPool }]);

    expect(render(read, 137)).toContain(`href="/holdings?chain=polygon&amp;address=${OWNER}"`);
  });

  it("lists no more positions than it shows, however many are smart", () => {
    const many = Array.from({ length: SMART_POSITIONS_SHOWN + 5 }, (_unused, index) => smartPosition(String(index)));

    expect(render(measured(many)).match(/This address&#x27;s positions/g)).toHaveLength(SMART_POSITIONS_SHOWN);
  });

  it("says how it measures on every read, and how many pools it could read when not all", () => {
    const html = render(measured([smartPosition("1")], 11));

    expect(html).toContain("$10,000");
    expect(html).toContain("20%");
    expect(html).toContain("The 20% with the highest yield");
    expect(html).toContain("11 of 12 pools could be read this time.");
    expect(html).toContain("Measured 2026-09-30 12:00 UTC.");
    expect(html).not.toContain("UTC UTC");
    expect(render(measured([smartPosition("1")]))).not.toContain("pools could be read");
  });

  it("says when nothing met the floors, or the read failed, and never shows figures then", () => {
    expect(render(measured([]))).toContain("No position met the floors this time.");
    const failed = render({ status: "unavailable", notice: "market-data-timed-out" });
    expect(failed).toContain("The positions could not be measured just now.");
    expect(failed).not.toContain("Where they are");
  });

  it("names the chains it reads on a chain whose positions cannot be listed, with a tab for each of those", () => {
    const html = render(null, 42161);

    expect(html).toContain("Positions cannot be listed on Arbitrum One");
    expect(html).toContain("This page reads Ethereum, Polygon.");
    expect(html).toContain('href="/smart-money?chain=polygon"');
    expect(html).not.toContain("?chain=arbitrum");
    expect(ETHEREUM.v3Positions).toBe(true);
  });

  it("speaks the reader's language", () => {
    expect(render(measured([smartPosition("1")]), 1, "tr")).toContain("Nerede duruyorlar");
  });
});
