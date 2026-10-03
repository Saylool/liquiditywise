import { describe, expect, it } from "vitest";

import { choosePriceQuote, quotedInterval, quotedPrice } from "../format/priceQuote";
import { chainBySlug, ETHEREUM } from "../chains/chains";
import {
  fixtureAnalysis,
  FIXTURE_FETCHED_AT,
  LIQUIDITY_HOOK,
  SWAP_HOOK,
  V3_POOL_ID,
  V4_POOL_ID,
} from "../testing/poolAnalysisFixture";
import type { EmbedRequest } from "./embedRequest";
import { embeddedPoolUrl, PoolEmbedSchema, poolEmbedData, poolEmbedFigures } from "./poolEmbed";

const V3: EmbedRequest = { protocol: "v3", chain: ETHEREUM, poolId: V3_POOL_ID };
const V4: EmbedRequest = { protocol: "v4", chain: ETHEREUM, poolId: V4_POOL_ID };

describe("a card's figures", () => {
  const analysis = fixtureAnalysis();
  const figures = poolEmbedFigures(analysis, V3);

  /* The fixture's own price is WETH per USDC; the page, and so the card, writes USDC per WETH. */
  it("are the pipeline's, turned the way the pool page turns them", () => {
    const quote = choosePriceQuote(analysis.pool, analysis.band.currentPrice);
    const edges = quotedInterval(quote, { lower: analysis.range.lowerPrice, upper: analysis.range.upperPrice });

    expect(figures.price).toEqual({ base: "WETH", quote: "USDC", current: quotedPrice(quote, analysis.band.currentPrice) });
    expect(figures.price.current).toBeCloseTo(3000, 6);
    expect(figures.range.lower).toBe(edges.lower);
    expect(figures.range.upper).toBe(edges.upper);
    expect(figures.range.lower).toBeLessThan(figures.price.current);
    expect(figures.range.upper).toBeGreaterThan(figures.price.current);
    expect(figures.range.currentInRange).toBe(true);
  });

  it("state the horizon and width they were drawn for, and when the price was read", () => {
    expect(figures.parameters).toEqual({ horizonDays: 30, standardDeviationMultiplier: 1 });
    expect(figures.analysedAt).toBe(FIXTURE_FETCHED_AT);
  });

  it("name the pool, its pair, its fee and its chain", () => {
    expect(figures).toMatchObject({
      protocol: "v3",
      pool: V3_POOL_ID,
      pair: { token0: "USDC", token1: "WETH" },
      lpFeePpm: 3000,
      chain: { id: 1, slug: "ethereum", name: "Ethereum" },
    });
  });

  it("link to the pool's page at the same horizon and width, naming the chain only off mainnet", () => {
    expect(figures.poolUrl).toBe(`https://liquiditywise.com/pool?address=${V3_POOL_ID}&days=30&sigma=1`);
    expect(embeddedPoolUrl({ ...V4, chain: chainBySlug("unichain")! })).toBe(
      `https://liquiditywise.com/v4?chain=unichain&id=${V4_POOL_ID}&days=30&sigma=1`,
    );
  });

  /* Only where it is true: not on a liquidity-only hook, a hookless v4 pool, or v3. */
  it("say a hook may change what a swap costs exactly where it may", () => {
    expect(figures.hookMayAlterSwaps).toBe(false);
    expect(poolEmbedFigures(fixtureAnalysis("v4", SWAP_HOOK), V4).hookMayAlterSwaps).toBe(true);
    expect(poolEmbedFigures(fixtureAnalysis("v4", LIQUIDITY_HOOK), V4).hookMayAlterSwaps).toBe(false);
    expect(poolEmbedFigures(fixtureAnalysis("v4", null), V4).hookMayAlterSwaps).toBe(false);
  });
});

describe("the JSON", () => {
  const data = poolEmbedData(poolEmbedFigures(fixtureAnalysis(), V3), "en");

  it("holds its schema, with every figure a number", () => {
    expect(data).not.toBeNull();
    expect(PoolEmbedSchema.safeParse(data).success).toBe(true);
    for (const value of [data?.price.current, data?.range.lower, data?.range.upper, data?.lpFeePpm, data?.parameters.horizonDays]) {
      expect(typeof value).toBe("number");
    }
  });

  it("carries a disclaimer in the language asked for, stating the days it measured", () => {
    expect(data?.disclaimer).toContain("not financial advice");
    expect(data?.disclaimer).toContain("30 days");
    expect(poolEmbedData(poolEmbedFigures(fixtureAnalysis(), V3), "tr")?.disclaimer).toContain("yatırım tavsiyesi değildir");
  });

  it("is not sent when its shape does not hold", () => {
    const figures = poolEmbedFigures(fixtureAnalysis(), V3);

    expect(poolEmbedData({ ...figures, range: { ...figures.range, lower: figures.range.upper * 2 } }, "en")).toBeNull();
    expect(poolEmbedData({ ...figures, price: { ...figures.price, current: Number.POSITIVE_INFINITY } }, "en")).toBeNull();
    expect(poolEmbedData({ ...figures, poolUrl: "https://example.com/pool" }, "en")).toBeNull();
  });
});
