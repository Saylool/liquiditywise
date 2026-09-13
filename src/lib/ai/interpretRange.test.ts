import { describe, expect, it } from "vitest";

import {
  type DataResult,
  INTERPRETATION_METHOD,
  type PoolDailyPriceHistory,
  type PoolMarketSnapshot,
  type V3Pool,
} from "../../schemas";
import {
  analysePoolRange,
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysis,
} from "../advisor/poolRangeAnalysis";
import { interpretRange } from "./interpretRange";
import { DEFAULT_INTERPRETATION_MODEL } from "./interpretationModel";
import type { ResponseCreator } from "./interpretationTransport";

const POOL_REF = { protocolVersion: "v3", chainId: 1, id: `0x${"c".repeat(40)}` } as const;
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

const history = ((): PoolDailyPriceHistory => {
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
})();

const ok = <T,>(data: T): DataResult<T> => ({ status: "success", data });

const analysis = ((): PoolRangeAnalysis => {
  const result = analysePoolRange({
    pool: ok(pool),
    snapshot: ok(snapshot),
    history: ok(history),
    parameters: DEFAULT_PRICE_BAND_PARAMETERS,
  });
  if (result.status === "unavailable") throw new Error("fixture should analyse");
  return result.data;
})();

/** What the model returns: four sections. The label is attached afterwards. */
const sections = {
  whatThisRangeMeans:
    "The suggested range covers the prices shown above, sitting either side of where the pool trades right now. While price stays inside it, the position is the one earning fees here.",
  ifPriceLeavesTheRange:
    "Once price moves past either edge, the position converts entirely into one of the two tokens and stops earning fees. It earns again only if price comes back inside the bounds.",
  whatTheVolatilitySays:
    "The volatility figure measures how much the daily closing price moved over the window shown. It describes the past; it is not a forecast, and a quiet month can be followed by a loud one.",
  whatThisDoesNotCover:
    "Nothing here accounts for the fees a position would earn, the impermanent loss it would carry, the gas spent opening and closing it, or whether the pool and its tokens are trustworthy.",
};

const answering = (text: string) => {
  const seen: { system?: string | undefined; user?: string | undefined } = {};
  const createResponse: ResponseCreator = async (params) => {
    seen.system = params.input.find((entry) => entry.role === "system")?.content;
    seen.user = params.input.find((entry) => entry.role === "user")?.content;
    return { output_text: text };
  };
  return { seen, createResponse };
};

const run = (
  createResponse: ResponseCreator,
  overrides: Partial<Parameters<typeof interpretRange>[0]> = {},
) =>
  interpretRange({
    analysis,
    warnings: [],
    locale: "en",
    apiKey: "sk-test",
    model: DEFAULT_INTERPRETATION_MODEL,
    createResponse,
    ...overrides,
  });

describe("interpretRange", () => {
  it("turns a finished analysis into a verified explanation", async () => {
    const { createResponse } = answering(JSON.stringify(sections));
    const result = await run(createResponse);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.interpretation.method).toBe(INTERPRETATION_METHOD);
  });

  /*
   * Credited from what the provider said answered, not from what was asked for:
   * an alias can resolve to a dated build, and a page naming the request rather
   * than the response would be stating something it never confirmed.
   */
  it("reports the model the provider says wrote it", async () => {
    const createResponse: ResponseCreator = async () => ({
      model: "gpt-5.6-terra-2026-08-01",
      output_text: JSON.stringify(sections),
    });

    const result = await run(createResponse);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.model).toBe("gpt-5.6-terra-2026-08-01");
  });

  it("falls back to the model it asked for when the provider names none", async () => {
    const { createResponse } = answering(JSON.stringify(sections));

    const result = await run(createResponse);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.model).toBe(DEFAULT_INTERPRETATION_MODEL);
  });

  it("sends the model both halves of the prompt built from that analysis", async () => {
    const { seen, createResponse } = answering(JSON.stringify(sections));
    await run(createResponse);

    expect(seen.system).toContain("NEVER STATE A FIGURE");
    expect(seen.user).toContain("USDC / WETH");
    expect(seen.user).toContain("Lower tick");
  });

  it("writes in the reader's language", async () => {
    const { seen, createResponse } = answering(JSON.stringify(sections));
    await run(createResponse, { locale: "tr" });

    expect(seen.user).toContain("Write in Turkish.");
    expect(seen.user).toContain("%0,30");
  });

  it("tells the model about the caveats attached to the analysis", async () => {
    const { seen, createResponse } = answering(JSON.stringify(sections));
    await run(createResponse, { warnings: ["Some days had no price."] });

    expect(seen.user).toContain("- Some days had no price.");
  });

  it("passes a transport failure through with its own category", async () => {
    const refusing: ResponseCreator = async () => {
      throw Object.assign(new Error("rate limited"), { status: 429 });
    };

    const result = await run(refusing);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("rate-limited");
  });

  it("drops an explanation that fails its contract, and keeps the figures", async () => {
    // The analysis is verified with or without prose. An explanation that broke
    // the rules is discarded rather than shown with a caveat.
    const { createResponse } = answering(
      JSON.stringify({
        ...sections,
        whatThisRangeMeans:
          "This range sits around 0.000333 WETH per USDC, which is where the pool trades today and why the bounds landed where they did on either side of it.",
      }),
    );

    const result = await run(createResponse);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("invalid-response");
  });

  it("never reaches the model without a key", async () => {
    let called = 0;
    const counting: ResponseCreator = async () => {
      called += 1;
      return { output_text: "" };
    };

    const result = await run(counting, { apiKey: undefined });

    expect(called).toBe(0);
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("configuration-error");
  });
});
