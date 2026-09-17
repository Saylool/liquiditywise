import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DataResult, PoolDailyPriceHistory, PoolMarketSnapshot, V3Pool } from "../schemas";
import { analysePoolRange, DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
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
    /* Half the value on each side, so a dollar converts back to $1 of USDC. */
    lockedToken0: 6_250_000,
    lockedToken1: 6_250_000 * CURRENT_PRICE,
    tick: 196_256,
    liquidity: "987654321",
    source: "uniswap-v3-subgraph",
    ...overrides,
  }) as unknown as PoolMarketSnapshot;

/** The window the fixtures span. Long enough for folds only when asked for. */
const history = (days = 31): PoolDailyPriceHistory => {
  const points: {
    timestamp: string;
    price: number;
    low: null;
    high: null;
    volumeUsd: null;
    feesUsd: null;
    activeLiquidity: string;
  }[] = [];
  let price = CURRENT_PRICE;
  for (let day = 0; day < days; day += 1) {
    if (day > 0) price *= day % 2 === 0 ? 1.01 : 1 / 1.01;
    points.push({
      timestamp: new Date(RANGE_START + day * DAY_MS).toISOString(),
      price,
      low: null, high: null, volumeUsd: null, feesUsd: null,
      activeLiquidity: "1000000000000000000",
    });
  }
  return {
    pool: POOL_REF,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    rangeStart: "2026-07-21T00:00:00.000Z",
    rangeEndExclusive: new Date(RANGE_START + days * DAY_MS).toISOString(),
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
    depositUsd: DEFAULT_DEPOSIT_USD,
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

    /*
     * Located by the panels' own ids rather than by their headings: every
     * heading is also a link in the contents above them, so `indexOf` on the
     * words would find the link and not the panel.
     */
    expect(controls).toBeGreaterThan(withControls.indexOf('id="basis"'));
    expect(controls).toBeLessThan(withControls.indexOf('id="activity"'));
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
      depositUsd: DEFAULT_DEPOSIT_USD,
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
      depositUsd: DEFAULT_DEPOSIT_USD,
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

    /*
     * Within the panel, located by its id: the current price is printed higher
     * up the page, and the panel's own heading is a link in the contents.
     */
    const panel = markup.slice(markup.indexOf('id="divergence"'));
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

/*
 * The form changes one width at a time; the table under it shows all of them
 * at once, computed the way the page computes its own, with the chosen one
 * marked and the two day counts told apart.
 */
describe("PoolRangeReport and the other widths", () => {
  it("compares the four offered widths and marks the one shown", () => {
    const markup = render(analyse());

    expect(markup).toContain("The other widths");
    expect(markup.match(/<tr[^>]*data-chosen="true"/g)).toHaveLength(1);
    expect(markup).toContain("Tight (1σ) · shown above");
    expect(markup).toContain("Medium (1.5σ)");
    expect(markup).toContain("Wide (2σ)");
    expect(markup).toContain("Very wide (3σ)");
    expect(markup).toContain("Inside, of the last 30 days");
  });

  /*
   * The trade-off the table exists for, as a number: the shown width reads as
   * one, a narrower width as more and a wider one as less.
   */
  it("says what each width does to the fee share, against the one shown", () => {
    const markup = render(analyse());
    const shares = [...markup.matchAll(/>([\d.]+)×</g)].map((match) => Number(match[1]));

    expect(markup).toContain("Fee share while inside");
    expect(shares).toHaveLength(4);
    expect(shares[0]).toBe(1);
    expect(shares[1]).toBeLessThan(1);
    expect(shares[3]).toBeLessThan(shares[2] ?? 0);
    expect(markup).toContain("It assumes the rest of the pool&#x27;s liquidity is unchanged");
  });

  /* A month of history fits a band and leaves nothing to check it on, and the column says so. */
  it("says when a width could not be checked on unseen days", () => {
    const markup = render(analyse());

    expect(markup).toContain("not enough history");
    expect(markup).toContain("None of these is a recommendation.");
  });

  it("writes the table in Turkish", () => {
    const markup = render(analyse(), "tr");

    expect(markup).toContain("Diğer genişlikler");
    expect(markup).toContain("Dar (1σ) · yukarıda gösterilen");
    expect(markup).toContain("Çok geniş (3σ)");
    expect(markup).toContain("yeterli geçmiş yok");
    expect(markup).toContain("İçerideyken komisyon payı");
    expect(markup).toContain("protokolün kendi pozisyon aritmetiği");
    expect(markup).not.toContain("shown above");
    expect(markup).not.toContain("Fee share");
  });
});

/*
 * What a reader who cannot see the page is given.
 *
 * Three of the panels are tables, and two of them were drawn with rows of
 * spans: they lined up on screen and said nothing to a screen reader, which
 * reads a cell without its column heading as a number with no name. These
 * check the structure rather than the words, so a table added later without a
 * name or without headed columns fails here.
 */
describe("PoolRangeReport and its tables", () => {
  const tablesIn = (markup: string) => markup.match(/<table[\s\S]*?<\/table>/g) ?? [];
  /* Four months of history, which is what leaves room to fit a band in the past and test it. */
  const withFolds = () => render(analyse({ history: ok(history(121)) }));

  it("draws the widths and the divergence as tables, and the folds when there are any", () => {
    expect(tablesIn(render(analyse()))).toHaveLength(2);
    expect(tablesIn(withFolds())).toHaveLength(3);
  });

  it("gives every table a name of its own", () => {
    for (const table of tablesIn(withFolds())) {
      expect(table).toMatch(/<caption class="sr-only">[^<]+<\/caption>/);
    }
  });

  it("heads every column, so a cell is never read without its heading", () => {
    for (const table of tablesIn(withFolds())) {
      const head = table.match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? "";
      const headings = head.match(/<th\b[^>]*>/g) ?? [];

      expect(headings.length).toBeGreaterThan(1);
      for (const heading of headings) expect(heading).toContain('scope="col"');
    }
  });

  it("makes the first cell of every row that row's heading", () => {
    for (const table of tablesIn(withFolds())) {
      const body = table.match(/<tbody[\s\S]*?<\/tbody>/)?.[0] ?? "";
      const rows = body.match(/<tr[\s\S]*?<\/tr>/g) ?? [];

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row).toMatch(/^<tr[^>]*>\s*<th\b[^>]*scope="row"/);
    }
  });

  it("names them in Turkish too", () => {
    const captions = tablesIn(render(analyse({ history: ok(history(121)) }), "tr")).map(
      (table) => table.match(/<caption class="sr-only">([^<]+)</)?.[1],
    );

    expect(captions).toEqual([
      "Diğer genişlikler",
      "Yöntemin sınandığı her aralık, en eskisi önce",
      "Sadece tutmaya kıyasla",
    ]);
  });
});

/*
 * The panel that turns the pool's fees into one position's.
 *
 * The default history carries no extremes, so no day can be placed inside the
 * range and the panel has nothing to divide. These fixtures give each day a
 * narrow high and low around its own close — well inside a band fitted to daily
 * moves an order of magnitude larger — so the days count and the arithmetic runs
 * through the real pipeline like everything else here.
 */
describe("what a deposit would have collected", () => {
  const settled = (): PoolDailyPriceHistory => {
    const base = history() as unknown as { points: Record<string, unknown>[] };

    return {
      ...(base as unknown as Record<string, unknown>),
      points: base.points.map((point) => ({
        ...point,
        low: (point.price as number) * 0.999,
        high: (point.price as number) * 1.001,
        volumeUsd: 1_000_000,
        feesUsd: 3_000,
        activeLiquidity: "1000000000000000000",
      })),
    } as unknown as PoolDailyPriceHistory;
  };

  const withDeposit = (depositUsd: number) =>
    render(analyse({ history: ok(settled()), depositUsd }));

  it("names the deposit it worked the figure out for", () => {
    const markup = withDeposit(10_000);

    expect(markup).toContain("What a deposit would have collected");
    expect(markup).toContain("$10,000");
  });

  it("says what the pool charged on those days and what the deposit takes of it", () => {
    const result = analyse({ history: ok(settled()), depositUsd: 10_000 });
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const { depositFeeShare, activity } = result.data;
    if (depositFeeShare.status !== "success") throw new Error(depositFeeShare.notice);

    /* The same days the activity panel counts, so the two totals are the same. */
    expect(depositFeeShare.data.poolFeesUsd).toBeCloseTo(
      activity.feesWhileFullyInsideUsd ?? -1,
      9,
    );
    expect(depositFeeShare.data.daysCounted).toBe(activity.occupancy.fullyInside);
    expect(depositFeeShare.data.depositFeesUsd).toBeLessThan(depositFeeShare.data.poolFeesUsd);
  });

  it("grows less than the deposit does", () => {
    const of = (depositUsd: number) => {
      const result = analyse({ history: ok(settled()), depositUsd });
      if (result.status === "unavailable") throw new Error("fixture should analyse");
      const share = result.data.depositFeeShare;
      if (share.status !== "success") throw new Error(share.notice);
      return share.data.depositFeesUsd;
    };

    const hundredfold = of(100_000) / of(1_000);

    expect(hundredfold).toBeGreaterThan(1);
    expect(hundredfold).toBeLessThan(100);
  });

  it("says why there is no figure when the days cannot be shared out", () => {
    const markup = render(analyse());

    expect(markup).toContain("What a deposit would have collected");
    expect(markup).toContain("cannot be worked out for this pool");
  });

  /*
   * The same refusal as the fees figure above it, through the same flag. A hook
   * that may take a share of the swap makes "the fees charged inside this range"
   * unattributable, and a fraction of an unattributable total is no better.
   */
  it("withholds the figure on a pool whose hook may alter a swap", () => {
    const SWAP_HOOK = `0x${"1".repeat(36)}00c4`;
    const V4_REF = { protocolVersion: "v4", chainId: 1, id: `0x${"d".repeat(64)}` } as const;
    const markup = render(
      analyse({
        pool: ok({
          ...V4_REF,
          token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
          token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
          tickSpacing: 60,
          fee: { kind: "static", feePpm: 3000 },
          protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 },
          hookAddress: SWAP_HOOK,
        } as unknown as V3Pool),
        snapshot: ok(snapshot({ pool: V4_REF, source: "uniswap-v4-subgraph" })),
        history: ok({
          ...(settled() as unknown as Record<string, unknown>),
          pool: V4_REF,
          source: "uniswap-v4-subgraph",
        } as unknown as PoolDailyPriceHistory),
        depositUsd: 10_000,
      }),
    );

    expect(markup).toContain("Not shown for this pool");
    expect(markup).toContain("cannot be attributed to a deposit in it either");
  });
});

/*
 * The panel that describes the other thing the same range can be.
 *
 * The fixture's pair is shown inverted — USDC per WETH, not the pool's own
 * direction — which is exactly the case that can put the two legs the wrong way
 * round, so that is what most of this checks.
 */
describe("selling and buying through the range", () => {
  const AGAINST = /Against the current price<\/dt><dd[^>]*>([^<]+)</g;

  it("names both legs by the token the page is quoting", () => {
    const markup = render(analyse());

    expect(markup).toContain("Selling and buying through the range");
    expect(markup).toContain("Selling WETH");
    expect(markup).toContain("Buying WETH");
  });

  /*
   * The pool's "above" is the reader's "below" here. If the panel took the legs
   * at their own names rather than comparing their prices, the selling leg would
   * be the one under the current price and this would be negative.
   */
  it("puts the selling leg above the current price and the buying leg below it", () => {
    const markup = render(analyse());
    const against = [...markup.matchAll(AGAINST)].map((match) => match[1] ?? "");

    expect(against).toHaveLength(2);
    expect(against[0]?.startsWith("-")).toBe(false);
    expect(against[1]?.startsWith("-")).toBe(true);
  });

  it("says what the figure does not promise", () => {
    const markup = render(analyse());

    expect(markup).toContain("only if the price crosses the whole band");
    expect(markup).toContain("This is not an order book");
  });

  it("says the same in Turkish", () => {
    const markup = render(analyse(), "tr");

    expect(markup).toContain("Aralıktan geçerken satmak ve almak");
    expect(markup).toContain("WETH satmak");
    expect(markup).toContain("WETH almak");
  });

  it("says why there is nothing to show when the range has no one-sided half", () => {
    const result = analyse();
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const markup = render({
      ...result,
      data: {
        ...result.data,
        rangeOrders: { status: "unavailable", notice: "range-order-no-room" },
      },
    });

    expect(markup).toContain("no one-sided half to describe");
    expect(markup).toContain("too narrow to hold a one-sided position");
  });
});

/*
 * The one panel about using the pool rather than providing to it.
 *
 * The success case is built from the tick the pipeline actually computed for the
 * fixture's price, handed back to the snapshot unchanged, rather than left to
 * whether the fixture's own tick happens to fall in the same step — the kind of
 * coincidence that quietly stops holding.
 */
describe("what a swap costs here", () => {
  const withTick = (shift: number) => {
    const first = analyse();
    if (first.status === "unavailable") throw new Error("fixture should analyse");

    return analyse({
      snapshot: ok(snapshot({ tick: first.data.range.currentTick + shift })),
    });
  };
  const agreeing = () => withTick(0);

  it("prices both directions, each named by the token going in", () => {
    const markup = render(agreeing());

    expect(markup).toContain("What a swap costs here");
    expect(markup).toContain("Selling USDC into the pool");
    expect(markup).toContain("Selling WETH into the pool");
    expect(markup).toContain("What it gives up");
  });

  it("says what goes in, in that token", () => {
    const result = agreeing();
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const depth = result.data.swapDepth;
    if (depth.status !== "success") throw new Error(depth.notice);

    const markup = render(result);

    expect(depth.data.sellingToken0?.amountIn).toBeGreaterThan(0);
    expect(depth.data.sellingToken1?.amountIn).toBeGreaterThan(0);
    /* The amount carries its own symbol, because a bare number has no unit. */
    expect(markup).toMatch(/[\d.,]+ USDC/);
    expect(markup).toMatch(/[\d.,]+ WETH/);
  });

  it("says it is not a limit, and where the certainty stops", () => {
    const markup = render(agreeing());

    expect(markup).toContain("Not a limit: a larger swap works");
    expect(markup).toContain("does not read the liquidity at every price");
  });

  /*
   * The guard that matters most here: the liquidity belongs to whichever step
   * the pool is actually in, and pricing a swap across a step it may not be in
   * would produce a perfectly reasonable-looking number.
   */
  /*
   * Built rather than provoked. Reaching this through the pipeline needs the
   * price to sit exactly on a spacing boundary with the source one tick below —
   * `calculateTickRange` refuses anything further apart, and stops the analysis
   * before this panel is reached. The calculator's own tests cover that window;
   * what is checked here is that the panel says which of the two it is.
   */
  it("says which reading refused when the two ticks disagree", () => {
    const result = agreeing();
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const markup = render({
      ...result,
      data: {
        ...result.data,
        swapDepth: { status: "unavailable", notice: "swap-depth-tick-disagreement" },
      },
    });

    expect(markup).toContain("cannot be worked out for this pool");
    expect(markup).toContain("different price step than the price shown");
  });

  it("says why only one direction is shown when only one is", () => {
    const result = agreeing();
    if (result.status === "unavailable") throw new Error("fixture should analyse");
    const depth = result.data.swapDepth;
    if (depth.status !== "success") throw new Error(depth.notice);

    const both = render(result);
    const one = render({
      ...result,
      data: {
        ...result.data,
        swapDepth: { status: "success", data: { ...depth.data, sellingToken1: null } },
      },
    });

    expect(both).not.toContain("Only one direction is shown");
    expect(one).toContain("Only one direction is shown");
    expect(one).not.toContain("Selling WETH into the pool");
  });

  it("says the same in Turkish", () => {
    const markup = render(agreeing(), "tr");

    expect(markup).toContain("Burada bir takas ne kadara mal olur");
    expect(markup).toContain("Havuza USDC satmak");
    expect(markup).toContain("Neden vazgeçiyor");
  });
});

/*
 * The page grew to eleven panels a panel at a time, without anyone deciding it
 * should. These are the checks that keep the way in honest: every link goes
 * somewhere, every panel can be reached, and the two lists cannot drift apart
 * because they are the same list.
 */
describe("the way into the page", () => {
  const anchors = (markup: string) => [...markup.matchAll(/href="#([a-zA-Z]+)"/g)].map((m) => m[1]);
  const targets = (markup: string) => [...markup.matchAll(/ id="([a-zA-Z]+)"/g)].map((m) => m[1]);

  it("lists the sections under the range rather than in front of it", () => {
    const markup = render(analyse());
    const contents = markup.indexOf("On this page");
    const firstPanel = markup.indexOf("Suggested price range");
    const secondPanel = markup.indexOf("How this range was drawn");

    expect(contents).toBeGreaterThan(firstPanel);
    expect(contents).toBeLessThan(secondPanel);
  });

  it("links every section it names to a panel that is there", () => {
    const markup = render(analyse());
    const linked = anchors(markup);
    const present = new Set(targets(markup));

    expect(linked.length).toBe(11);
    expect(linked.filter((id) => !present.has(id))).toEqual([]);
  });

  it("names every panel on the page, including the one that opens closed", () => {
    const markup = render(analyse());
    const linked = new Set(anchors(markup));

    for (const id of targets(markup)) {
      expect(linked.has(id)).toBe(true);
    }
    expect(linked.has("technical")).toBe(true);
  });

  it("is a labelled navigation rather than a list of stray links", () => {
    const markup = render(analyse());

    expect(markup).toContain('<nav aria-label="The sections of this analysis"');
  });

  it("names the sections in the reader's language", () => {
    const markup = render(analyse(), "tr");

    expect(markup).toContain("Bu sayfada");
    expect(markup).toContain("Bu analizin bölümleri");
    expect(markup).not.toContain("On this page");
  });
});
