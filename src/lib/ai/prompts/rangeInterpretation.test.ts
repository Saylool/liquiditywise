import { describe, expect, it } from "vitest";

import type {
  DataResult,
  DataWarningNotice,
  PoolDailyPriceHistory,
  PoolMarketSnapshot,
  V3Pool,
} from "../../../schemas";
import {
  analysePoolRange,
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysis,
} from "../../advisor/poolRangeAnalysis";
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
      "Fee tier",
      "Tick spacing",
      "Current price",
      "Current tick",
      "Annualised volatility",
      "Measured over",
      "Window coverage",
      "Band lower bound",
      "Lower tick",
      "Price at the lower tick",
      "Width in tick spacings",
      "Current price inside the range",
    ]) {
      expect(user).toContain(label);
    }
    expect(user).toContain("USDC / WETH");
  });

  it("shows the model the same strings the reader sees", () => {
    // A model reasoning over "70.50%" while the page shows "%70,50" is reasoning
    // about a different-looking page than the one being read.
    expect(build("en").user).toContain("0.30%");
    expect(build("tr").user).toContain("%0,30");
    expect(build("en").user).toContain("0.000333333");
    expect(build("tr").user).toContain("0,000333333");
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
    expect(user).not.toContain("liquidity");
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

  it("reports each edge on its own", () => {
    /*
     * This pool trades at a positive tick, so a widening band runs past the top
     * of TickMath well before the bottom. Each edge is pinned separately —
     * a single "truncated" match would pass with the other one broken.
     */
    const { user } = promptForMultiplier(400);

    expect(user).toContain("Lower edge: placed where the band asked");
    expect(user).toContain("Upper edge: truncated at the highest tick this pool accepts");
  });

  it("tells the model when neither edge could be placed", () => {
    const { user } = promptForMultiplier(600);

    expect(user).toContain("Lower edge: truncated at the lowest tick this pool accepts");
    expect(user).toContain("Upper edge: truncated at the highest tick this pool accepts");
  });

  it("says when each edge went where the band asked", () => {
    const { user } = build();

    expect(user).toContain("Lower edge: placed where the band asked");
    expect(user).toContain("Upper edge: placed where the band asked");
  });
});

/*
 * Read across four live pools, the explanation got direction wrong about half
 * the time: it called a price quoted in WETH per USDC "WETH başına USDC" —
 * Turkish for the exact opposite — and named the wrong token at each edge of the
 * range for one pool while naming the right one for the next. Both facts are
 * fixed by the protocol and by the pool's own token order, so both are stated in
 * the prompt now instead of being left for a model to work out.
 */
describe("directional facts the model is not asked to derive", () => {
  it("says what a price figure means in a sentence, not a per-pair", () => {
    const { user } = build();

    expect(user).toContain(
      "- What every price figure on the page means: how much WETH one USDC is worth",
    );
    // The short form is the one that inverts under translation.
    expect(user).not.toContain("WETH per USDC");
  });

  it("names the token a position holds at each edge, and they differ", () => {
    const { user } = build();

    expect(user).toContain("- If price falls below the range, a position holds only: USDC");
    expect(user).toContain("- If price rises above the range, a position holds only: WETH");
  });

  it("follows the pool's token order rather than a fixed pair of names", () => {
    /*
     * Only the symbols are swapped. Decimals drive the tick maths and the
     * chain cross-check, so a fixture that swapped those would fail to analyse
     * for reasons that have nothing to do with what this test is about.
     */
    const { user } = buildRangeInterpretationPrompt({
      analysis: {
        ...analysis,
        pool: {
          ...analysis.pool,
          token0: { ...analysis.pool.token0, symbol: "WETH" },
          token1: { ...analysis.pool.token1, symbol: "USDC" },
        },
      },
      locale: "en",
      warnings: [],
    });

    expect(user).toContain("- If price falls below the range, a position holds only: WETH");
    expect(user).toContain("- If price rises above the range, a position holds only: USDC");
    expect(user).toContain(
      "- What every price figure on the page means: how much USDC one WETH is worth",
    );
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
    // The two the interface itself had to stop conflating.
    expect(user).toContain('tick spacing: "tick adımı"');
    expect(user).toContain('the suggested tick range: "tick aralığı"');
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
