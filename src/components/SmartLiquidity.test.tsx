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
import type { SmartHistory } from "../lib/advisor/getSmartHistory";
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
              medianLowerPrice: PRICE * 0.95,
              medianUpperPrice: PRICE * 1.02,
              medianYearlyYield: 0.34,
              currentPrice: PRICE,
            },
          ],
  },
});

const render = (read: SmartLiquidityRead | null, chainId = 1, locale: Locale = "en", history: SmartHistory | null = null) =>
  renderToStaticMarkup(
    <SmartLiquidity
      read={read}
      history={history}
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
    expect(html).toContain("This page reads Ethereum, Base, OP Mainnet, Polygon.");
    expect(html).toContain('href="/smart-money?chain=base"');
    expect(html).toContain('href="/smart-money?chain=optimism"');
    expect(html).toContain('href="/smart-money?chain=polygon"');
    expect(html).not.toContain("?chain=arbitrum");
    expect(ETHEREUM.v3Positions).toBe(true);
  });

  it("speaks the reader's language", () => {
    expect(render(measured([smartPosition("1")]), 1, "tr")).toContain("Nerede duruyorlar");
  });
});

describe("the smart-money page over time", () => {
  const trend = (overrides: Record<string, unknown> = {}): SmartHistory["trend"] => ({
    since: "2026-09-23T00:00:00.000Z",
    days: 7,
    pairs: [
      {
        pool: POOL.id,
        pair: "USDC / WETH",
        feePpm: 500,
        currentPrice: PRICE,
        then: { lowerRatio: 0.9, upperRatio: 1.05 },
        now: { lowerRatio: 0.95, upperRatio: 1.02 },
        shareThen: 0.2,
        shareNow: 0.31,
        widths: [0.16, 0.12, 0.08],
        positionsNow: 4,
      },
      {
        pool: `0x${"2".repeat(40)}`,
        pair: "WBTC / USDT",
        feePpm: 500,
        currentPrice: 0.0001,
        then: null,
        now: { lowerRatio: 0.98, upperRatio: 1.03 },
        shareThen: null,
        shareNow: 0.1,
        widths: [0.05],
        positionsNow: 2,
      },
    ],
    gaining: [{ pool: POOL.id, pair: "USDC / WETH", feePpm: 500, from: 0.2, to: 0.31 }],
    losing: [{ pool: `0x${"3".repeat(40)}`, pair: "WETH / USDT", feePpm: 3000, from: 0.3, to: 0.1 }],
    ...overrides,
  });
  const history = (overrides: Partial<SmartHistory> = {}): SmartHistory => ({ trend: trend(), holders: [], ...overrides });
  const around = (read = measured([smartPosition("1")]), h: SmartHistory | null = history()) => render(read, 1, "en", h);

  it("shows each followed pair's range then and now, in the pair's quote, with its share and a line of its width", () => {
    const html = around();

    expect(html).toContain("How it moved over the last 7 days");
    expect(html).toContain("Range: ");
    /* WETH in USDC, so the edges invert and swap: then 1/1.05 - 1 .. 1/0.9 - 1, now 1/1.02 - 1 .. 1/0.95 - 1. */
    expect(html).toContain("-4.76% to +11.11% around the price → -1.96% to +5.26% around the price");
    expect(html).toContain("Share of the smart money: 20.00% → 31.00%");
    expect(html).toContain('aria-label="Range width, from 16.00% to 8.00%"');
  });

  it("says a pair new among the top, and draws no line for a width measured once", () => {
    const html = around();

    expect(html).toContain("not among the top pairs at the start");
    expect(html).toContain("Share of the smart money: 10.00%");
    expect(html.match(/<svg/g)).toHaveLength(1);
  });

  it("names the pairs gaining and losing smart money", () => {
    const html = around();

    expect(html).toContain("Gaining smart money");
    expect(html).toContain("USDC / WETH · 0.05%: 20.00% → 31.00%");
    expect(html).toContain("Losing smart money");
    expect(html).toContain("WETH / USDT · 0.30%: 30.00% → 10.00%");
    expect(around(undefined, history({ trend: trend({ gaining: [], losing: [] }) }))).not.toContain("Gaining smart money");
  });

  it("says it needs a day of measurements when the trend is not there yet, and shows nothing of it where none is kept", () => {
    expect(around(undefined, history({ trend: null }))).toContain("Trends appear once a day of measurements has been kept.");
    expect(around(undefined, null)).not.toContain("How it moved");
    expect(around(undefined, null)).not.toContain("Holders that keep showing up");
  });

  it("lists the holders that keep showing up, wallets and contracts named, with what each has among the smart positions now", () => {
    const stranger = `0x${"e".repeat(40)}`;
    const html = around(
      undefined,
      history({
        holders: [
          { address: OWNER, appeared: 27, of: 28, contract: false },
          { address: stranger, appeared: 20, of: 28, contract: true },
        ],
      }),
    );

    expect(html).toContain("Holders that keep showing up");
    expect(html).toContain("in the smart fifth in at least half of the last 28 measurements");
    expect(html).toContain("In 27 of 28 measurements");
    expect(html).toContain("Wallet");
    expect(html).toContain("Contract");
    expect(html).toContain("1 smart positions now, worth $50,000");
    expect(html).toContain("None among the smart positions in the latest measurement");
    expect(html).toContain("A contract: a vault, a bot or another program");
    expect(html).toContain(`href="/holdings?address=${stranger}"`);
  });

  it("says what is kept about the holders, and that nothing is kept about readers, and gives no contract note when there is no contract", () => {
    const html = around(undefined, history({ holders: [{ address: OWNER, appeared: 27, of: 28, contract: false }] }));

    expect(html).toContain("Nothing about who reads this page is kept.");
    expect(html).not.toContain("A contract: a vault");
  });

  it("says it needs a couple of days before it can name any holder", () => {
    expect(around(undefined, history({ holders: null }))).toContain("Needs about two days of measurements");
  });
});
