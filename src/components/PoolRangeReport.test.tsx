import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DataResult, PoolDailyPriceHistory, PoolMarketSnapshot, V3Pool } from "../schemas";
import { analysePoolRange, DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import { formatPercent, formatPrice } from "../lib/format/displayFormats";
import {
  choosePriceQuote,
  edgeDistances,
  quotedInterval,
  quotedPrice,
} from "../lib/format/priceQuote";
import { getDictionary } from "../lib/i18n/dictionaries";
import { PoolRangeReport } from "./PoolRangeReport";

/*
 * Rendered through `react-dom/server`, which needs no DOM and no browser. The
 * fixtures go through the real pipeline rather than being hand-written result
 * objects, so the markup is asserted against figures the application would
 * actually produce.
 */

const POOL_ID = `0x${"c".repeat(40)}`;
const POOL_REF = { protocolVersion: "v3", chainId: 1, id: POOL_ID } as const;
const FETCHED_AT = "2026-08-21T09:15:00.000Z";
const CURRENT_PRICE = 1 / 3000;
const DAY_MS = 86_400_000;
const RANGE_START = Date.parse("2026-07-21T00:00:00.000Z");

const pool = (token0Decimals = 6, token1Decimals = 18): V3Pool =>
  ({
    ...POOL_REF,
    token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: token0Decimals },
    token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: token1Decimals },
    feePpm: 3000,
    tickSpacing: 60,
  }) as unknown as V3Pool;

const snapshot = (overrides: Record<string, unknown> = {}): PoolMarketSnapshot =>
  ({
    pool: POOL_REF,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    token0PriceInToken1: CURRENT_PRICE,
    token1PriceInToken0: 1 / CURRENT_PRICE,
    tvlUsd: 12_500_000,
    tick: 196_256,
    liquidity: "987654321",
    source: "uniswap-v3-subgraph",
    ...overrides,
  }) as unknown as PoolMarketSnapshot;

const history = (): PoolDailyPriceHistory => {
  const points: {
    timestamp: string;
    price: number;
    low: null;
    high: null;
    volumeUsd: null;
    feesUsd: null;
  }[] = [];
  let price = CURRENT_PRICE;
  for (let day = 0; day < 31; day += 1) {
    if (day > 0) price *= day % 2 === 0 ? 1.01 : 1 / 1.01;
    points.push({
      timestamp: new Date(RANGE_START + day * DAY_MS).toISOString(),
      price,
      low: null, high: null, volumeUsd: null, feesUsd: null,
    });
  }
  return {
    pool: POOL_REF,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    rangeStart: "2026-07-21T00:00:00.000Z",
    rangeEndExclusive: new Date(RANGE_START + 31 * DAY_MS).toISOString(),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points,
    source: "uniswap-v3-subgraph",
  } as unknown as PoolDailyPriceHistory;
};

const ok = <T,>(data: T): DataResult<T> => ({ status: "success", data });

const analyse = (overrides: Partial<Parameters<typeof analysePoolRange>[0]> = {}) =>
  analysePoolRange({
    pool: ok(pool()),
    snapshot: ok(snapshot()),
    history: ok(history()),
    parameters: DEFAULT_PRICE_BAND_PARAMETERS,
    ...overrides,
  });

const render = (result: ReturnType<typeof analysePoolRange>, locale: "en" | "tr" = "en") =>
  renderToStaticMarkup(
    <PoolRangeReport
      result={result}
      poolId={POOL_ID}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

describe("PoolRangeReport", () => {
  const markup = render(analyse());

  it("names the pair, the fee and the id", () => {
    expect(markup).toContain("USDC");
    expect(markup).toContain("WETH");
    expect(markup).toContain("0.30% fee on every swap");
    expect(markup).toContain(POOL_ID);
  });

  /*
   * The pool quotes ether in dollars — 0.000333 WETH per USDC — and a reader
   * is told the reverse: one WETH is worth three thousand USDC. Every price
   * on the page follows, including the range's two edges.
   */
  it("writes every price as one unit of the dearer token in the cheaper", () => {
    const result = analyse();
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const { band, range } = result.data;
    const quote = choosePriceQuote(result.data.pool, band.currentPrice);
    const edges = quotedInterval(quote, { lower: range.lowerPrice, upper: range.upperPrice });

    expect(quote.inverted).toBe(true);
    expect(markup).toContain("1 WETH = 3,000 USDC");
    expect(markup).toContain(
      `${formatPrice(edges.lower)} – ${formatPrice(edges.upper)} USDC per WETH`,
    );
    expect(edges.lower).toBeLessThan(3000);
    expect(edges.upper).toBeGreaterThan(3000);
  });

  it("says how far the price would have to move to leave, in the shown direction", () => {
    const result = analyse();
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const { band, range } = result.data;
    const quote = choosePriceQuote(result.data.pool, band.currentPrice);
    const distances = edgeDistances(
      quotedPrice(quote, band.currentPrice),
      quotedInterval(quote, { lower: range.lowerPrice, upper: range.upperPrice }),
    );

    expect(markup).toContain(
      `${formatPercent(distances.down)} below and ${formatPercent(distances.up)} above the current price.`,
    );
  });

  /* As ether falls the position finishes in ether; as it rises, in dollars. */
  it("names the token a position is left with beyond each edge, the reader's way round", () => {
    expect(markup).toContain(
      "the position ends up holding only WETH; if it rises above it, only USDC.",
    );
  });

  /*
   * The pool's price can go no higher exactly where the reader's can go no
   * lower, so the pool's truncated top is reported as the reader's cut-short
   * bottom — and on the chart that edge is open: the band runs off the
   * bottom, and no line or figure is drawn for a price forty orders of
   * magnitude away.
   */
  it("reports a truncated edge on the edge the reader sees, and leaves it open on the chart", () => {
    const result = analyse({ parameters: { horizonDays: 365, standardDeviationMultiplier: 400 } });
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    expect(result.data.range.upperBoundTruncated).toBe(true);
    expect(result.data.range.lowerBoundTruncated).toBe(false);

    const truncated = render(result);
    expect(truncated).toContain(
      "The lower edge stops at the lowest price this pool can express, short of where the band would have put it.",
    );
    expect(truncated).not.toContain("The upper edge stops at the highest price");
    expect(truncated).toContain('role="img"');
    expect(truncated).not.toContain(">2.9543E-27</text>");
    expect(truncated.match(/stroke-dasharray="4 4"/g)?.length).toBe(1);
    // The caveat from the data layer names no edge: its code is the pool's edge, not the reader's.
    expect(truncated).toContain("The range panel says which edge that is in the direction shown.");
    expect(truncated).not.toMatch(/upper edge stops/i);
  });

  /* The form that changes the range sits under the figures it changes, not after the whole report. */
  it("places the controls directly under how the range was drawn", () => {
    const withControls = renderToStaticMarkup(
      <PoolRangeReport
        result={analyse()}
        poolId={POOL_ID}
        controls={<form id="controls" />}
        t={getDictionary("en")}
        locale="en"
      />,
    );
    const controls = withControls.indexOf('<form id="controls">');

    expect(controls).toBeGreaterThan(withControls.indexOf("How this range was drawn"));
    expect(controls).toBeLessThan(withControls.indexOf("What the pool actually did"));
  });

  it("still shows the controls when there is no analysis to show", () => {
    const failed = renderToStaticMarkup(
      <PoolRangeReport
        result={{ status: "unavailable", step: "history", reason: "network-error", notice: "market-data-unreachable" }}
        poolId={POOL_ID}
        controls={<form id="controls" />}
        t={getDictionary("en")}
        locale="en"
      />,
    );

    expect(failed).toContain('<form id="controls">');
  });

  /* The same thirty days the activity figures count, drawn through the range. */
  it("draws the last month through the range, a dot per day", () => {
    const result = analyse();
    if (result.status === "unavailable") throw new Error("fixture should analyse");

    expect(markup).toContain('role="img" aria-label="The last month');
    expect(markup.match(/<circle /g)?.length).toBe(result.data.activity.daysMeasured);
    expect(markup).toContain("Each of the last 30 days");
    expect(markup).toContain(">1 WETH = 3,000 USDC<");
  });

  /*
   * The ticks are still on the page — a reader checking it against the chain
   * needs them — but nowhere before the technical details at the end. A
   * reader who never opens that section never meets the word.
   */
  it("keeps every tick behind the technical details", () => {
    const result = analyse();
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const technical = markup.indexOf("Technical details");

    expect(technical).toBeGreaterThan(0);
    expect(markup.toLowerCase().indexOf("tick")).toBeGreaterThan(technical);
    expect(markup).toContain(result.data.range.lowerTick.toLocaleString("en-US"));
    expect(markup).toContain(result.data.range.upperTick.toLocaleString("en-US"));
    // And the pool's own direction, likewise: after the fold, not before it.
    expect(markup.indexOf("WETH per USDC")).toBeGreaterThan(technical);
  });

  it("keeps a small price readable rather than rounding it away", () => {
    // A two-decimal formatter would render this pool's price as "0.00".
    expect(markup).toContain("0.000333333");
    expect(markup).not.toContain(">0.00<");
  });

  it("formats every figure it shows", () => {
    // A field routed through the wrong formatter, or a missing one, surfaces here.
    expect(markup).not.toContain("NaN");
    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("[object Object]");
  });

  it("says the current price is inside the range, in a sentence", () => {
    expect(markup).toContain("The current price is inside this range.");
    expect(markup).toContain("would be active straight away");
    expect(markup).not.toContain("is outside this range");
  });

  it("explains what the range means without a term of art", () => {
    expect(markup).toContain("Between these two prices a position earns its share");
    expect(markup).toContain("Typical daily move");
    expect(markup).toContain("How this range was drawn");
  });

  it("shows volatility as a percentage, not as a bare ratio", () => {
    const result = analyse();
    if (result.status === "unavailable") throw new Error("fixture should analyse");

    expect(markup).toContain(formatPercent(result.data.volatility.annualizedVolatility));
    expect(markup).toContain(formatPercent(result.data.volatility.dailyVolatility));
  });

  it("states what the band is not", () => {
    expect(markup).toContain("not a forecast");
    expect(markup).toContain("not a confidence level");
  });

  it("lists every caveat when the run was partial", () => {
    const result = analysePoolRange({
      pool: ok(pool()),
      snapshot: {
        status: "partial",
        data: snapshot(),
        missingFields: ["sourceBlockTimestamp"],
        warnings: ["block-time-unreported"],
      },
      history: ok(history()),
      parameters: DEFAULT_PRICE_BAND_PARAMETERS,
    });

    const partialMarkup = render(result);
    expect(partialMarkup).toContain(
      "The data source did not report a block time",
    );
    // Singular and plural are both grammatical; a single template for both is not.
    expect(partialMarkup).toContain("One caveat applies");
    expect(partialMarkup).not.toContain("One caveat apply");
  });

  it("counts caveats in the plural when there is more than one", () => {
    const result = analysePoolRange({
      pool: ok(pool()),
      snapshot: {
        status: "partial",
        data: snapshot({ sourceBlockTimestamp: null }),
        missingFields: ["sourceBlockTimestamp"],
        warnings: ["block-time-unreported"],
      },
      history: ok(history()),
      parameters: DEFAULT_PRICE_BAND_PARAMETERS,
    });
    if (result.status !== "partial") throw new Error("fixture should warn");

    expect(render(result)).toContain(`${result.warnings.length} caveats apply`);
    expect(result.warnings.length).toBeGreaterThan(1);
  });

  it("says the conversion is unverified when the source reported no tick", () => {
    const unverified = render(analyse({ snapshot: ok(snapshot({ tick: null })) }));

    expect(unverified).toContain("reported no tick of its own");
  });

  it("shows an unreported TVL as absent rather than as zero", () => {
    const noTvl = render(analyse({ snapshot: ok(snapshot({ tvlUsd: null })) }));

    // Named rather than searched for globally: "$0.00" legitimately appears
    // elsewhere now, where the pool really did charge nothing.
    expect(noTvl).toContain("Total value locked</dt><dd class=\"font-mono text-sm\">—</dd>");
  });
});

describe("PoolRangeReport in Turkish", () => {
  const markup = render(analyse(), "tr");

  it("translates the labels", () => {
    expect(markup).toContain("Önerilen fiyat aralığı");
    expect(markup).toContain("Bu aralık nasıl çizildi");
    expect(markup).toContain("Havuz gerçekte ne yaptı");
    expect(markup).toContain("Teknik ayrıntılar");
    expect(markup).not.toContain("Suggested price range");
    expect(markup).not.toContain("How this range was drawn");
  });

  it("captions the chart in Turkish", () => {
    expect(markup).toContain('aria-label="Son bir ayın fiyatları, önerilen aralığa karşı"');
    expect(markup).toContain("Son 30 günün her biri");
    expect(markup).toContain("Dolu nokta");
    expect(markup).not.toContain("Each of the last");
  });

  it("keeps every tick behind the technical details, in Turkish too", () => {
    const technical = markup.indexOf("Teknik ayrıntılar");

    expect(technical).toBeGreaterThan(0);
    expect(markup.toLowerCase().indexOf("tick")).toBeGreaterThan(technical);
    expect(markup).toContain("Alt tick");
  });

  it("writes the numbers the way Turkish writes them", () => {
    // Half a translation would keep "0.30%", "3,000" and "0.000333333" here.
    expect(markup).toContain("%0,30"); // the fixture pool's 3000 ppm fee
    expect(markup).toContain("1 WETH = 3.000 USDC");
    expect(markup).toContain("0,000333333");
  });

  it("keeps the pool's own symbols and address untouched", () => {
    expect(markup).toContain("USDC");
    expect(markup).toContain("WETH");
    expect(markup).toContain(POOL_ID);
  });

  it("names the stage that stopped, in Turkish", () => {
    const failed = render(
      {
        status: "unavailable",
        step: "history",
        reason: "network-error",
        notice: "market-data-unreachable",
      },
      "tr",
    );

    expect(failed).toContain("havuzun günlük fiyat geçmişi okunurken");
    /*
     * And the sentence itself, which used to arrive from the data layer already
     * written in English and went out to a Turkish page that way.
     */
    expect(failed).toContain("Piyasa verisi kaynağına ulaşılamadı.");
    expect(failed).not.toContain("could not be reached");
  });

  it("formats every figure it shows", () => {
    expect(markup).not.toContain("NaN");
    expect(markup).not.toContain("undefined");
  });
});

describe("PoolRangeReport when there is nothing to show", () => {
  it("names the stage that stopped and repeats its message", () => {
    const failed = render({
      status: "unavailable",
      step: "history",
      reason: "network-error",
      notice: "market-data-unreachable",
    });

    expect(failed).toContain("reading the pool&#x27;s daily price history");
    expect(failed).toContain("The market data source could not be reached.");
    expect(failed).toContain("network-error");
  });

  it("shows no figures at all rather than blanks where numbers belong", () => {
    const failed = render({
      status: "unavailable",
      step: "pool",
      reason: "configuration-error",
      notice: "market-data-not-configured",
    });

    expect(failed).not.toContain("Suggested price range");
    expect(failed).not.toContain("How this range was drawn");
  });
});

/*
 * The one figure on this page that owes nothing to a data source — and the one
 * most likely to be read as half an answer, so what it leaves out is asserted
 * as carefully as what it says.
 */
describe("PoolRangeReport against simply holding", () => {
  const markup = render(analyse());

  it("shows a row for each price the comparison was made at", () => {
    expect(markup).toContain("Compared with just holding");
    expect(markup).toContain("Position against holding");
    expect(markup).toContain("Price of WETH");
  });

  /* The same direction as every other price on the page, and still ascending. */
  it("prices the rows the reader's way round, lowest first", () => {
    const result = analyse();
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const { divergence, band, pool } = result.data;
    const quote = choosePriceQuote(pool, band.currentPrice);
    const shown = divergence.points.map((point) => quotedPrice(quote, point.price)).sort((a, b) => a - b);

    // Within the panel: the current price is also printed higher up the page.
    const panel = markup.slice(markup.indexOf("Compared with just holding"));
    const positions = shown.map((value) => panel.indexOf(`${formatPrice(value)} USDC<`));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(shown[0]).toBeLessThan(3000);
  });

  it("reports no divergence at the price it was measured from", () => {
    // The entry row is the pool's current price, where holding and the position
    // are worth exactly the same.
    expect(markup).toContain("0.00%");
  });

  it("says the comparison counts price movement and not fees", () => {
    expect(markup).toContain("says nothing about the fees a position would earn");
  });

  /*
   * The name everyone uses is wrong in a way worth correcting: nothing is
   * impermanent about a position closed at a different price.
   */
  it("says why the usual name for it is misleading", () => {
    expect(markup).toContain("only impermanent if price comes back");
  });

  it("never claims a position beats holding on price movement", () => {
    const losses = [...markup.matchAll(/>([\-−]?\d+\.\d+%)</g)].map((m) => m[1] ?? "");

    expect(losses.some((value) => value.startsWith("-") || value === "0.00%")).toBe(true);
  });

  it("translates", () => {
    const turkish = render(analyse(), "tr");

    expect(turkish).toContain("Sadece tutmaya kıyasla");
    expect(turkish).toContain("Pozisyon, tutmaya kıyasla");
    expect(turkish).toContain("geçici kayıp");
    expect(turkish).not.toContain("Compared with just holding");
  });
});

/*
 * The panel that exists because v4 severed the link between the fee a pool
 * declares and the fee it charges.
 *
 * These fixtures go through the real pipeline like the ones above, and the v4
 * ones use real hook addresses — a v4 hook is deployed to a mined address whose
 * last fourteen bits are its permission list, so the address in a fixture has to
 * carry the bits the test is about.
 */
describe("what the pool actually charged", () => {
  const V4_ID = `0x${"d".repeat(64)}`;
  const V4_REF = { protocolVersion: "v4", chainId: 1, id: V4_ID } as const;

  /** `beforeSwap`, `afterSwap` and `afterSwapReturnsDelta` — a real shape. */
  const SWAP_HOOK = `0x${"1".repeat(36)}00c4`;
  /** `beforeAddLiquidity` alone: it never runs on a swap. */
  const LIQUIDITY_HOOK = `0x${"1".repeat(36)}0800`;

  const traded = (feesPerMillion: number) => {
    const base = history() as unknown as { points: Record<string, unknown>[] };

    return {
      ...(base as unknown as Record<string, unknown>),
      points: base.points.map((point) => ({
        ...point,
        volumeUsd: 1_000_000,
        feesUsd: feesPerMillion,
      })),
    } as unknown as PoolDailyPriceHistory;
  };

  const v4Pool = (hookAddress: string | null, feePpm = 3000, protocolPpm = 0, protocolOneForZeroPpm = protocolPpm) =>
    ({
      ...V4_REF,
      token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
      token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
      tickSpacing: 60,
      fee: { kind: "static", feePpm },
      protocolFee: { zeroForOnePpm: protocolPpm, oneForZeroPpm: protocolOneForZeroPpm },
      hookAddress,
    }) as unknown as V3Pool;

  const v4Parts = (
    hookAddress: string | null,
    feesPerMillion: number,
    feePpm = 3000,
    protocolPpm = 0,
    protocolOneForZeroPpm = protocolPpm,
  ) => ({
    pool: ok(v4Pool(hookAddress, feePpm, protocolPpm, protocolOneForZeroPpm)),
    snapshot: ok(snapshot({ pool: V4_REF, source: "uniswap-v4-subgraph" })),
    history: ok({
      ...(traded(feesPerMillion) as unknown as Record<string, unknown>),
      pool: V4_REF,
      source: "uniswap-v4-subgraph",
    } as unknown as PoolDailyPriceHistory),
  });

  it("confirms a v3 pool that charged exactly its tier", () => {
    const markup = render(analyse({ history: ok(traded(3000)) }));

    expect(markup).toContain("What it actually charged");
    expect(markup).toContain("The declared rate is the rate that was charged");
  });

  /*
   * The ETH/USDC pool as the chain holds it: 500 ppm to providers, 125 ppm to
   * the protocol on top, 625 ppm paid by every swap. The stated fee the
   * measurement is compared against is the 625 — which is what the indexer
   * had been calling the tier — and the page says how it was arrived at.
   */
  it("compares against what a swap pays once the protocol's cut is on top", () => {
    const markup = render(analyse(v4Parts(null, 625, 500, 125)));

    expect(markup).toContain("0.05% fee on every swap, plus 0.0125% to the protocol");
    expect(markup).toContain("The declared rate is the rate that was charged");
    expect(markup).toContain("Stated fee</dt><dd class=\"font-mono text-sm\">0.0625%</dd>");
    expect(markup).toContain("0.05% to liquidity providers and 0.0125% to the protocol");
  });

  it("calls a hookless v4 pool that charged only its own fee a disagreement, once the cut is stated", () => {
    const markup = render(analyse(v4Parts(null, 500, 500, 125)));

    expect(markup).toContain("These do not agree");
  });

  it("names no cut in the header when the protocol takes none", () => {
    const markup = render(analyse(v4Parts(null, 3000)));

    expect(markup).toContain("0.30% fee on every swap</p>");
    expect(markup).not.toContain("to the protocol");
  });

  /* A cut that differs by direction makes the stated fee a range, and a day inside it agrees. */
  it("states a range when the cut differs by direction, and accepts a day inside it", () => {
    const markup = render(analyse(v4Parts(null, 625, 500, 100, 125)));

    expect(markup).toContain("0.05% fee on every swap, plus 0.01% – 0.0125% to the protocol");
    expect(markup).toContain("Stated fee</dt><dd class=\"font-mono text-sm\">0.06% – 0.0625%</dd>");
    expect(markup).toContain("The declared rate is the rate that was charged");
  });

  /*
   * The case the panel is for. The busiest hooked pool on mainnet declares 250
   * ppm and charged between 25 and 230 over a month; this fixture is the same
   * shape, a pool charging a fifth of what it says.
   */
  it("says so when a hooked v4 pool charged something else", () => {
    const markup = render(analyse(v4Parts(SWAP_HOOK, 600)));

    expect(markup).toContain("These do not agree");
    expect(markup).toContain("0.06%");
  });

  it("names the rate as not reaching a provider when the hook may take a share", () => {
    const markup = render(analyse(v4Parts(SWAP_HOOK, 600)));

    expect(markup).toContain("None of this is what reaches a liquidity provider");
  });

  /*
   * A hook that only runs on deposits cannot touch a swap, so it is owed no
   * caveat at all — and the fees inside the range stay a figure.
   */
  it("says nothing extra for a hook that never runs on a swap", () => {
    const markup = render(analyse(v4Parts(LIQUIDITY_HOOK, 3000)));

    expect(markup).not.toContain("None of this is what reaches a liquidity provider");
    expect(markup).not.toContain("Not shown for this pool");
  });

  it("withholds the fees attributed to the range when the hook may take a share", () => {
    const markup = render(analyse(v4Parts(SWAP_HOOK, 600)));

    expect(markup).toContain("Not shown for this pool");
    // React escapes the apostrophe, so the assertion sits either side of it.
    expect(markup).toContain("nothing in the source separates the hook");
    expect(markup).toContain("from the liquidity providers");
  });

  /* The fees the pool charged are a fact, and they stay. Only attribution goes. */
  it("still shows the fees the pool charged over the month", () => {
    const markup = render(analyse(v4Parts(SWAP_HOOK, 600)));

    expect(markup).toContain("Fees charged, 30d");
  });

  it("reports a rate rather than zero when no day could be measured", () => {
    const markup = render(analyse());

    expect(markup).toContain("What this pool charges could not be measured");
    expect(markup).toContain("traded nothing on any indexed day");
  });

  describe("in Turkish", () => {
    it("translates the panel and writes the rate the Turkish way", () => {
      const markup = render(analyse(v4Parts(SWAP_HOOK, 600)), "tr");

      expect(markup).toContain("Gerçekte ne kadar aldı");
      expect(markup).toContain("%0,06");
      expect(markup).toContain("Birbirini tutmuyor");
    });
  });
});
