import { describe, expect, it } from "vitest";

import type {
  DataResult,
  DataWarningNotice,
  PoolDailyPriceHistory,
  PoolMarketSnapshot,
  V3Pool,
  V4Pool,
} from "../../../schemas";
import {
  analysePoolRange,
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysis,
} from "../../advisor/poolRangeAnalysis";
import { formatPrice } from "../../format/displayFormats";
import { choosePriceQuote, quotedInterval } from "../../format/priceQuote";
import { BASE_INSTRUCTION } from "./base";
import { buildRangeInterpretationPrompt } from "./rangeInterpretation";

const POOL_ID = `0x${"c".repeat(40)}`;
const POOL_REF = { protocolVersion: "v3", chainId: 1, id: POOL_ID } as const;
const FETCHED_AT = "2026-08-21T09:15:00.000Z";
const CURRENT_PRICE = 1 / 3000;
const DAY_MS = 86_400_000;
const RANGE_START = Date.parse("2026-07-21T00:00:00.000Z");

const pool = {
  ...POOL_REF,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
  feePpm: 3000,
  tickSpacing: 60,
} as unknown as V3Pool;

const snapshot = {
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
} as unknown as PoolMarketSnapshot;

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

const analysis = ((): PoolRangeAnalysis => {
  const result = analysePoolRange({
    pool: ok(pool),
    snapshot: ok(snapshot),
    history: ok(history()),
    parameters: DEFAULT_PRICE_BAND_PARAMETERS,
  });
  if (result.status === "unavailable") throw new Error("fixture should analyse");
  return result.data;
})();

const build = (locale: "en" | "tr" = "en", warnings: readonly DataWarningNotice[] = []) =>
  buildRangeInterpretationPrompt({ analysis, locale, warnings });

/*
 * A second fixture, long enough for the out-of-sample check to run: 31 closes to
 * fit from plus a full 30-day horizon to test against. The short one above is
 * kept because it exercises the other branch — a pool too young to be checked —
 * which every other test in this file happens to run through.
 *
 * Extremes bracket each day's own close here, where the short fixture leaves
 * them null, so the days can actually be placed inside or outside a band.
 */
const longHistory = (): PoolDailyPriceHistory => {
  const points: unknown[] = [];
  let price = CURRENT_PRICE;
  for (let day = 0; day < 61; day += 1) {
    if (day > 0) price *= day % 2 === 0 ? 1.01 : 1 / 1.01;
    points.push({
      timestamp: new Date(RANGE_START + day * DAY_MS).toISOString(),
      price,
      low: price * 0.995,
      high: price * 1.005,
      volumeUsd: 1_000_000,
      feesUsd: 500,
    });
  }

  return {
    ...(history() as unknown as Record<string, unknown>),
    rangeEndExclusive: new Date(RANGE_START + 61 * DAY_MS).toISOString(),
    points,
  } as unknown as PoolDailyPriceHistory;
};

const checkedAnalysis = ((): PoolRangeAnalysis => {
  const result = analysePoolRange({
    pool: ok(pool),
    snapshot: ok(snapshot),
    history: ok(longHistory()),
    parameters: DEFAULT_PRICE_BAND_PARAMETERS,
  });
  if (result.status === "unavailable") throw new Error("fixture should analyse");
  return result.data;
})();

const buildChecked = (locale: "en" | "tr" = "en") =>
  buildRangeInterpretationPrompt({ analysis: checkedAnalysis, locale, warnings: [] });

/*
 * A v4 pool, hooked or not, through the same pipeline. The hook address carries
 * its permissions in its last fourteen bits, as v4 mines them: this one may run
 * before and after a swap and take a share of it.
 */
const V4_ID = `0x${"d".repeat(64)}`;
const V4_REF = { protocolVersion: "v4", chainId: 1, id: V4_ID } as const;
const SWAP_HOOK = `0x${"1".repeat(36)}00c4`;
const LIQUIDITY_HOOK = `0x${"1".repeat(36)}0800`;
const WITHDRAWAL_HOOK = `0x${"1".repeat(36)}0200`;
const NO_BITS_HOOK = `0x${"1".repeat(36)}0000`;

const v4Analysis = (
  hookAddress: string | null,
  protocolPpm = 0,
  fee: V4Pool["fee"] = { kind: "static", feePpm: 250 },
): PoolRangeAnalysis => {
  const v4Pool = {
    ...V4_REF,
    token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
    token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
    tickSpacing: 60,
    fee,
    protocolFee: { zeroForOnePpm: protocolPpm, oneForZeroPpm: protocolPpm },
    hookAddress,
  } as unknown as V4Pool;
  const result = analysePoolRange({
    pool: ok(v4Pool),
    snapshot: ok({ ...snapshot, pool: V4_REF, source: "uniswap-v4-subgraph" } as PoolMarketSnapshot),
    history: ok({ ...history(), pool: V4_REF, source: "uniswap-v4-subgraph" } as PoolDailyPriceHistory),
    parameters: DEFAULT_PRICE_BAND_PARAMETERS,
  });
  if (result.status === "unavailable") throw new Error(`v4 fixture should analyse: ${result.notice}`);
  return result.data;
};

const buildV4 = (hookAddress: string | null, locale: "en" | "tr" = "en") =>
  buildRangeInterpretationPrompt({ analysis: v4Analysis(hookAddress), locale, warnings: [] });

describe("buildRangeInterpretationPrompt", () => {
  it("is deterministic", () => {
    expect(build()).toEqual(build());
  });

  it("keeps the system instruction byte-identical whatever the request", () => {
    // This is what lets it sit in front of the prompt cache instead of
    // invalidating it on every call.
    expect(build("en").system).toBe(BASE_INSTRUCTION);
    expect(build("tr", ["block-time-unreported"]).system).toBe(BASE_INSTRUCTION);
  });

  it("names the language to write in", () => {
    expect(build("en").user).toContain("Write in English.");
    expect(build("tr").user).toContain("Write in Turkish.");
  });

  it("carries every figure the explanation refers to", () => {
    const { user } = build();

    for (const label of [
      "Pair",
      /*
       * Named for who receives it, not "fee tier": a v4 pool's key fee is what
       * providers get, the protocol's cut sits on top, and a hook may charge
       * something else on every swap.
       */
      "Fee to liquidity providers",
      "What a swap pays, by the pool's own terms",
      "Price step between the edges a position may use",
      "Current price",
      "Typical daily move",
      "Horizon",
      "The same movement over the horizon",
      "Range width, in multiples of that, each way",
      "Measured over",
      "Window coverage",
      "Lower edge",
      "Upper edge",
      "Distance down to the lower edge",
      "Current price inside the range",
    ]) {
      expect(user).toContain(label);
    }
    expect(user).toContain("USDC / WETH");
  });

  /*
   * The page shows the range as two prices and folds the ticks away, so a
   * tick handed to the model would be a coordinate the reader has not seen.
   */
  it("hands over prices and never a tick", () => {
    const { user, system } = build();

    expect(user).not.toMatch(/tick/i);
    expect(user).toContain("SUGGESTED PRICE RANGE");
    expect(system).toContain("PRICES, NOT TICKS");
  });

  /*
   * The section that exists because v4 severed the link between what a pool
   * declares and what it charges. On a fixture charging exactly its declared
   * rate the model is told so in one line; the page prints the rest.
   */
  it("carries what the pool actually charged, measured", () => {
    const user = buildChecked("en").user;

    expect(user).toContain("WHAT IT ACTUALLY CHARGED");
    expect(user).toContain("Rate actually charged, median day: 0.05%");
    expect(user).toContain("Against what the pool says a swap pays: different on");
  });

  /*
   * The short fixture reports no volume at all, so no rate can be divided out of
   * it. The model must be told that plainly rather than handed a zero, which
   * would read as a pool that charges nothing.
   */
  it("says a rate was not measurable rather than reporting it as zero", () => {
    const user = build("en").user;

    expect(user).toContain("not measurable");
    expect(user).not.toContain("Rate actually charged, median day: 0%");
  });

  it("shows the model the same strings the reader sees", () => {
    // A model reasoning over "70.50%" while the page shows "%70,50", or over
    // "0.000333333" while the page shows "1 WETH = 3,000 USDC", is reasoning
    // about a different-looking page than the one being read.
    expect(build("en").user).toContain("0.30%");
    expect(build("tr").user).toContain("%0,30");
    expect(build("en").user).toContain("1 WETH = 3,000 USDC");
    expect(build("tr").user).toContain("1 WETH = 3.000 USDC");
    expect(build("en").user).not.toContain("0.000333333");
  });

  it("passes the caveats through, and says so when there are none", () => {
    expect(build("en", ["history-window-incomplete"]).user).toContain(
      "- The data source did not report a price for every day",
    );
    expect(build().user).toContain("CAVEATS\n- none");
  });

  it("repeats the rule that matters most", () => {
    expect(build().user).toContain("may not write any number");
    expect(build().system).toContain("NEVER STATE A FIGURE");
  });

  /*
   * The page states a few lines above the explanation that this tool does not
   * predict prices. A model that calls the band the "expected range" puts the
   * page in contradiction with itself — and the schema cannot see tone, so the
   * instruction has to carry it.
   */
  it("forbids framing the band as a forecast", () => {
    const { system } = build();

    expect(system).toContain("THE BAND MEASURES THE PAST");
    expect(system).toContain("expected");
    expect(system).toContain("does not predict prices");
  });

  it("asks for the four parts the output schema requires", () => {
    const { user } = build();

    expect(user).toContain("what the suggested range means");
    expect(user).toContain("what happens if price leaves it");
    expect(user).toContain("what the volatility figure is saying");
    expect(user).toContain("what this analysis does not cover");
  });

  /*
   * The prompt is a curated projection of verified data, not a dump. Nothing a
   * stranger wrote reaches it — the only visitor input is a pool address, and it
   * passed a strict hex pattern long before this point — so there is no opening
   * for an injected instruction to arrive through the data.
   */
  it("sends only what the explanation needs", () => {
    const { user } = build();

    expect(user).not.toContain(POOL_ID);
    // The snapshot's raw liquidity figure, under any label.
    expect(user).not.toMatch(/liquidity:/i);
    expect(user).not.toContain("987654321");
    expect(user).not.toContain("{");
  });

  it("changes when the figures change", () => {
    const widened = analysePoolRange({
      pool: ok(pool),
      snapshot: ok(snapshot),
      history: ok(history()),
      parameters: { horizonDays: 365, standardDeviationMultiplier: 2 },
    });
    if (widened.status === "unavailable") throw new Error("fixture should analyse");

    const other = buildRangeInterpretationPrompt({
      analysis: widened.data,
      locale: "en",
      warnings: [],
    });

    expect(other.user).not.toBe(build().user);
  });

  const promptForMultiplier = (standardDeviationMultiplier: number) => {
    const result = analysePoolRange({
      pool: ok(pool),
      snapshot: ok(snapshot),
      history: ok(history()),
      parameters: { horizonDays: 365, standardDeviationMultiplier },
    });
    if (result.status === "unavailable") throw new Error("fixture should analyse");

    return buildRangeInterpretationPrompt({ analysis: result.data, locale: "en", warnings: [] });
  };

  it("reports each edge on its own, in the reader's direction", () => {
    /*
     * This pool trades at a positive tick, so a widening band runs past the top
     * of TickMath well before the bottom. The page prices ether in dollars, so
     * the pool's top is the reader's bottom: the *lower* edge is the one that
     * stops short. Each edge is pinned separately — a single "truncated" match
     * would pass with the other one broken, and with both on the wrong edge.
     */
    const { user } = promptForMultiplier(400);

    expect(user).toContain("Lower edge placement: truncated at the lowest price this pool can express");
    expect(user).toContain("Upper edge placement: placed where the band asked");
  });

  /* The values themselves, the reader's way round: below and above three thousand. */
  it("prices the edges the page's way round", () => {
    const { user } = build();
    const edges = quotedInterval(
      choosePriceQuote(analysis.pool, analysis.band.currentPrice),
      { lower: analysis.range.lowerPrice, upper: analysis.range.upperPrice },
    );

    expect(edges.lower).toBeLessThan(3000);
    expect(edges.upper).toBeGreaterThan(3000);
    expect(user).toContain(`- Lower edge: ${formatPrice(edges.lower)} USDC per WETH`);
    expect(user).toContain(`- Upper edge: ${formatPrice(edges.upper)} USDC per WETH`);
  });

  it("lists the comparison against holding lowest price first, the page's way round", () => {
    const { user } = build();
    const prices = [...user.matchAll(/- Against holding, at ([\d,.]+) USDC/g)].map((match) =>
      Number((match[1] ?? "").replace(/,/g, "")),
    );

    expect(prices.length).toBe(analysis.divergence.points.length);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices[0]).toBeLessThan(3000);
  });

  it("tells the model when neither edge could be placed", () => {
    const { user } = promptForMultiplier(600);

    expect(user).toContain("Lower edge placement: truncated at the lowest price this pool can express");
    expect(user).toContain("Upper edge placement: truncated at the highest price this pool can express");
  });

  it("says when each edge went where the band asked", () => {
    const { user } = build();

    expect(user).toContain("Lower edge placement: placed where the band asked");
    expect(user).toContain("Upper edge placement: placed where the band asked");
  });
});

/*
 * Read across four live pools, the explanation got direction wrong about half
 * the time: it called a price quoted in WETH per USDC "WETH başına USDC" —
 * Turkish for the exact opposite — and named the wrong token at each edge of the
 * range for one pool while naming the right one for the next. Both facts are
 * fixed by the protocol and by the direction the page writes its prices in, so
 * both are stated in the prompt now instead of being left for a model to work
 * out.
 *
 * That direction is the page's: one unit of the dearer token, priced in the
 * cheaper. The fixture pool quotes ether in dollars, at a third of a
 * thousandth, and the page — and so the prompt — turns it round.
 */
describe("directional facts the model is not asked to derive", () => {
  it("says what a price figure means in a sentence, the page's way round", () => {
    const { user } = build();

    expect(user).toContain(
      "- What every price figure on the page means: how much USDC one WETH is worth",
    );
    expect(user).toContain("- Current price: 1 WETH = 3,000 USDC");
    // The short form is the one that inverts under translation.
    expect(user).not.toContain("WETH per USDC");
  });

  /* As ether falls the position finishes in ether; as it rises, in dollars. */
  it("names the token a position holds at each edge, and they differ", () => {
    const { user } = build();

    expect(user).toContain("- If price falls below the range, a position holds only: WETH");
    expect(user).toContain("- If price rises above the range, a position holds only: USDC");
  });

  it("follows the price rather than the pool's token order", () => {
    /*
     * The same shape of pool with its price above one — the pool's own
     * direction is then the readable one, and nothing is turned round. The
     * history is rebuilt from the new price so the fixture still analyses,
     * and the source's tick is dropped so the cross-check has nothing to
     * disagree with.
     */
    const dearToken0 = 3000;
    let price = dearToken0;
    const points = history().points.map((point, day) => {
      if (day > 0) price *= day % 2 === 0 ? 1.01 : 1 / 1.01;
      return { ...point, price };
    });
    const result = analysePoolRange({
      pool: ok({
        ...pool,
        token0: { ...pool.token0, symbol: "WBTC", decimals: 8 },
        token1: { ...pool.token1, symbol: "USDC", decimals: 6 },
      } as V3Pool),
      snapshot: ok({
        ...snapshot,
        token0PriceInToken1: dearToken0,
        token1PriceInToken0: 1 / dearToken0,
        tick: null,
      } as PoolMarketSnapshot),
      history: ok({ ...history(), points } as PoolDailyPriceHistory),
      parameters: DEFAULT_PRICE_BAND_PARAMETERS,
    });
    if (result.status === "unavailable") throw new Error(`fixture should analyse: ${result.notice}`);

    const { user } = buildRangeInterpretationPrompt({
      analysis: result.data,
      locale: "en",
      warnings: [],
    });

    expect(user).toContain("- If price falls below the range, a position holds only: WBTC");
    expect(user).toContain("- If price rises above the range, a position holds only: USDC");
    expect(user).toContain(
      "- What every price figure on the page means: how much USDC one WBTC is worth",
    );
    expect(user).toContain("- Current price: 1 WBTC = 3,000 USDC");
  });

  it("carries the rules that put those facts beyond debate", () => {
    const { system } = build();

    expect(system).toContain("DIRECTION IS GIVEN, NOT DERIVED");
    expect(system).toContain("SAY WHAT THE FIGURES SHOW");
  });
});

/*
 * One deployment called gas both "gas" and "gaz", impermanent loss both "geçici
 * kayıp" and "impermanent loss", and wrote "yıllıklaştırılmış" in a paragraph
 * sitting directly under a label reading "Yıllıklandırılmış".
 */
describe("terminology", () => {
  it("pins the words Turkish prose should use", () => {
    const { user } = build("tr");

    expect(user).toContain("WORDS TO USE");
    expect(user).toContain('impermanent loss: "geçici kayıp"');
    expect(user).toContain('gas: "gas", never "gaz"');
    // Written as "volatility" in Turkish prose until the list said otherwise.
    expect(user).toContain('volatility: "volatilite"');
    // The page's own words for the two things it used to call by one name.
    expect(user).toContain('the price step between usable edges: "fiyat adımı"');
    expect(user).toContain('the suggested range: "aralık"');
  });

  it("leaves English alone, where the interface already uses the model's words", () => {
    expect(build("en").user).not.toContain("WORDS TO USE");
  });
});


/*
 * The section added the day the page grew an out-of-sample check.
 *
 * Until then the model was told, correctly, that the day counts beside the
 * pool's activity were measured over the days the range was drawn from and so
 * tested nothing — and it wrote that the analysis had no independent check. That
 * sentence stopped being true the moment one appeared directly above the prose,
 * and a text that says the page lacks what the page is showing is worse than a
 * text that says nothing.
 */
describe("the out-of-sample check, as the model is told about it", () => {
  it("says the check was run, and how it turned out", () => {
    const { user } = buildChecked();

    expect(user).toContain("THE SAME METHOD, ON DAYS IT NEVER SAW");
    expect(user).toContain(
      "- Was the method checked on days it was not fitted to: yes",
    );
    expect(user).toContain("- Stretches checked: 1");
    expect(user).toContain("- Days checked: 30");
  });

  /*
   * A total can hide its own shape: two thirds of the days holding is a
   * different thing to tell a reader when every stretch behaved alike than when
   * two were perfect and one collapsed. The spread is handed over rather than
   * left to be inferred, like every other direction in this prompt.
   */
  it("hands over the spread between stretches rather than only the total", () => {
    const { user } = buildChecked();

    expect(user).toContain("- Best single stretch, days inside:");
    expect(user).toContain("- Worst single stretch, days inside:");
  });

  it("fences off the conclusion the number invites", () => {
    const { user } = buildChecked();

    expect(user).toContain("Do not restate the limits printed beside the figures");
    expect(user).toContain("never write that the method works, usually works, or is reliable");
  });

  it("says plainly when the pool was too young to check, and forbids inventing one", () => {
    // The short fixture: 31 closes, which leaves no horizon to test against.
    const { user } = build();

    expect(user).toContain(
      "- Was the method checked on days it was not fitted to: no",
    );
    expect(user).toContain("Never that one was run");
  });

  /*
   * The line that produced the false sentence. It still says the activity day
   * counts describe the fit — that part was always true — but it no longer says
   * the analysis has nothing that tests it.
   */
  it("scopes the in-sample caveat to the day counts it belongs to", () => {
    const { user } = buildChecked();

    expect(user).toContain("- Why these day counts do not test the range:");
    expect(user).not.toContain("so they describe the fit rather than test it");
  });

  it("puts the standing instruction in charge of telling the two apart", () => {
    expect(BASE_INSTRUCTION).toContain(
      "Do not write that the analysis has no out-of-sample check when the request says it has one",
    );
  });
});

/*
 * The hook is the one fact about a v4 pool the model must be told and must not
 * embellish. It is told what the protocol permits the hook to do — read from
 * the address, the page prints the same list — and nothing about what the hook
 * does, who wrote it, or where it lives.
 */
describe("buildRangeInterpretationPrompt and the fee", () => {
  it("tells the model who receives the fee, what the protocol takes on top, and what a swap pays", () => {
    const { user } = buildRangeInterpretationPrompt({ analysis: v4Analysis(null, 125), locale: "en", warnings: [] });

    expect(user).toContain("- Fee to liquidity providers: 0.025%");
    expect(user).toContain("- Fee to the protocol, taken on top: 0.0125%");
    expect(user).toContain("- What a swap pays, by the pool's own terms: 0.0375%");
  });

  it("leaves the protocol's line out where it takes nothing", () => {
    expect(buildV4(null).user).not.toContain("Fee to the protocol");
    expect(build().user).not.toContain("Fee to the protocol");
  });

  it("says a dynamic pool's fee is the hook's to decide", () => {
    const dynamic = v4Analysis(SWAP_HOOK);
    const { user } = buildRangeInterpretationPrompt({
      analysis: { ...dynamic, pool: { ...dynamic.pool, fee: { kind: "dynamic", currentFeePpm: null } } as PoolRangeAnalysis["pool"] },
      locale: "en",
      warnings: [],
    });

    expect(user).toContain("- Fee to liquidity providers: none fixed; this pool's hook sets the fee on each swap");
    expect(user).toContain("- What a swap pays, by the pool's own terms: decided per swap by the hook");
  });
});

describe("buildRangeInterpretationPrompt and the hook", () => {
  it("names the protocol", () => {
    expect(buildV4(null).user).toContain("Protocol: Uniswap v4");
    expect(build().user).toContain("Protocol: Uniswap v3");
  });

  it("gives a v3 pool no hook section at all", () => {
    expect(build().user).not.toContain("HOOK");
    expect(build().user).not.toContain("Hook:");
  });

  it("says a hookless v4 pool behaves as a v3 pool does", () => {
    const user = buildV4(null).user;

    expect(user).toContain("HOOK\n- Hook: none; the pool behaves the way a v3 pool does");
    expect(user).not.toContain("permitted");
  });

  /*
   * In the page's own sentences, grouped as the page groups them, and never
   * in the protocol's names: a model handed `afterSwapReturnsDelta` would
   * explain the name to a reader who was never shown it.
   */
  it("tells the model what the hook may do in the page's sentences, not the protocol's names", () => {
    const user = buildV4(SWAP_HOOK).user;

    expect(user).toContain("Hook: present");
    expect(user).toContain(
      "- What it is permitted to do (Around swaps): Run before every swap, where it can refuse the swap and, on a pool with a dynamic fee, set what that swap pays. Run after every swap, where it can still refuse the swap. Take a share of a swap after the pool has priced it.",
    );
    expect(user).toContain("May change what a swap costs or pays: yes");
    expect(user).toContain("May refuse a withdrawal, or take a share of one: no");
    expect(user).not.toContain("beforeSwap");
    expect(user).not.toContain("ReturnsDelta");
  });

  it("says no when the hook cannot touch a swap", () => {
    const user = buildV4(LIQUIDITY_HOOK).user;

    expect(user).toContain(
      "- What it is permitted to do (Around deposits and withdrawals): Run before every deposit, where it can refuse the deposit.",
    );
    expect(user).not.toContain("(Around swaps)");
    expect(user).toContain("May change what a swap costs or pays: no");
  });

  it("says yes when the hook runs at a withdrawal", () => {
    const user = buildV4(WITHDRAWAL_HOOK).user;

    expect(user).toContain("Run before every withdrawal, where it can refuse the withdrawal.");
    expect(user).toContain("May refuse a withdrawal, or take a share of one: yes");
  });

  /* The same sentences the Turkish page prints, so the prose and the page agree on their words. */
  it("gives the sentences in the reader's language", () => {
    const user = buildV4(SWAP_HOOK, "tr").user;

    expect(user).toContain(
      "- What it is permitted to do (Takaslarda): Her takastan önce çalışmak; orada takası reddedebilir",
    );
    expect(user).not.toContain("Around swaps");
  });

  /* Only valid on a dynamic-fee pool, where such a hook exists to set the fee. */
  it("says a hook with no permission bits is called at none of those moments", () => {
    const { user } = buildRangeInterpretationPrompt({
      analysis: v4Analysis(NO_BITS_HOOK, 0, { kind: "dynamic", currentFeePpm: null }),
      locale: "en",
      warnings: [],
    });

    expect(user).toContain(
      "- What it is permitted to do: Nothing around swaps, deposits or donations: the protocol calls it at none of those moments.",
    );
    expect(user).toContain("May change what a swap costs or pays: no");
  });

  /* Identity is not the model's business, and an address is the one thing it could echo. */
  it("never hands the model the hook's address", () => {
    expect(buildV4(SWAP_HOOK).user).not.toContain(SWAP_HOOK);
  });

  it("tells the model what it may and may not say about the hook", () => {
    const user = buildV4(SWAP_HOOK).user;

    expect(user).toContain("in plain words as the page puts them; never what it does, whether it is safe, or who wrote it");
  });

  it("keeps the system instruction identical for v3 and v4", () => {
    expect(buildV4(SWAP_HOOK).system).toBe(build().system);
  });
});

/*
 * The page compares every offered width; the model is handed the same rows in
 * the page's own words and figures, and asked for the trade-off alone.
 */
describe("buildRangeInterpretationPrompt and the other widths", () => {
  it("hands the model every width the page compares, the shown one marked", () => {
    const { user } = buildChecked();
    const section = user.slice(user.indexOf("THE OTHER WIDTHS"), user.indexOf("AGAINST SIMPLY HOLDING"));

    expect(section).toContain("- Tight (1σ), the one shown: 1 WETH = ");
    expect(section).toContain("- Medium (1.5σ): 1 WETH = ");
    expect(section).toContain("- Wide (2σ): ");
    expect(section).toContain("- Very wide (3σ): ");
    expect(section).toMatch(/inside on \d+ of the last \d+ days; inside on \d+ of \d+ days it never saw/);
    expect(section).toContain("1× the fee share of the shown width on a day inside");
    expect(section).toMatch(/Very wide \(3σ\):[^\n]*0\.\d+× the fee share of the shown width/);
    expect(section).toContain("Never which width to choose");
  });

  it("says when a width could not be checked on unseen days", () => {
    const { user } = build();

    expect(user).toContain("- Tight (1σ), the one shown: 1 WETH = ");
    expect(user).toContain("not enough history to check");
  });

  it("names the widths in the reader's language", () => {
    const { user } = buildChecked("tr");

    expect(user).toContain("- Dar (1σ), the one shown: 1 WETH = ");
    expect(user).toContain("- Çok geniş (3σ): ");
    expect(user).not.toContain("Tight");
  });
});
