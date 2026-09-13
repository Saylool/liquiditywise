import { describe, expect, it } from "vitest";

import type { DataResult, PoolDailyPriceHistory, PoolMarketSnapshot, V3Pool } from "../../../schemas";
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
  volume24hUsd: null,
  volume7dUsd: null,
  volume30dUsd: null,
  tick: 196_256,
  liquidity: "987654321",
  source: "uniswap-v3-subgraph",
} as unknown as PoolMarketSnapshot;

const history = (): PoolDailyPriceHistory => {
  const points: { timestamp: string; price: number }[] = [];
  let price = CURRENT_PRICE;
  for (let day = 0; day < 31; day += 1) {
    if (day > 0) price *= day % 2 === 0 ? 1.01 : 1 / 1.01;
    points.push({ timestamp: new Date(RANGE_START + day * DAY_MS).toISOString(), price });
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

const build = (locale: "en" | "tr" = "en", warnings: readonly string[] = []) =>
  buildRangeInterpretationPrompt({ analysis, locale, warnings });

describe("buildRangeInterpretationPrompt", () => {
  it("is deterministic", () => {
    expect(build()).toEqual(build());
  });

  it("keeps the system instruction byte-identical whatever the request", () => {
    // This is what lets it sit in front of the prompt cache instead of
    // invalidating it on every call.
    expect(build("en").system).toBe(BASE_INSTRUCTION);
    expect(build("tr", ["A caveat."]).system).toBe(BASE_INSTRUCTION);
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
    expect(build("en", ["Some days had no price."]).user).toContain("- Some days had no price.");
    expect(build().user).toContain("CAVEATS\n- none");
  });

  it("repeats the rule that matters most", () => {
    expect(build().user).toContain("may not write any number");
    expect(build().system).toContain("NEVER STATE A FIGURE");
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
