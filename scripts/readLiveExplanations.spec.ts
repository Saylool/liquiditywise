/*
 * A tool for reading what the model actually writes, not a test.
 *
 * Everything else about the explanation can be checked without a network: the
 * prompt is pure, the schema rejects a figure, and the transport is tested
 * against a stub. What none of that can tell you is whether the sentences are
 * any good — whether they say something about *this* pool, whether they use the
 * same words the interface uses, whether they have the direction right.
 *
 * That question needs live pools and a real model, so this runs neither by
 * default: with no pools named it skips, and `npm test` stays hermetic.
 *
 *   NODE_USE_ENV_PROXY=1 TONE_POOLS=0x…,0x… TONE_LOCALES=tr,en \
 *     node --env-file=.env.local ./node_modules/vitest/vitest.mjs run \
 *     scripts/readLiveExplanations.spec.ts
 *
 * It writes one JSON row per pool and language to TONE_OUT, each carrying the
 * prose beside the facts it should agree with — which token the price is quoted
 * in, which token the position holds at each edge, how far the current price
 * sits from each bound. Reading those side by side is what caught the model
 * naming the wrong token at both edges of one pool while naming the right one
 * at the next.
 *
 * It calls the model directly rather than through `getRangeInterpretation`, so
 * an edited prompt is read back on the next run instead of an hour later.
 */

import { writeFileSync } from "node:fs";

import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { describe, it } from "vitest";

import {
  analysePoolRange,
  DEFAULT_PRICE_BAND_PARAMETERS,
} from "../src/lib/advisor/poolRangeAnalysis";
import { interpretRange } from "../src/lib/ai/interpretRange";
import { resolveInterpretationModel } from "../src/lib/ai/interpretationModel";
import { LOCALES, type Locale } from "../src/lib/i18n/locales";
import { fetchEthereumV3DailyPriceHistory } from "../src/lib/uniswap/ethereumV3DailyPriceHistory";
import { fetchEthereumV3Pool } from "../src/lib/uniswap/ethereumV3Pool";
import { fetchEthereumV3PoolMarketSnapshot } from "../src/lib/uniswap/ethereumV3PoolMarketSnapshot";

const POOL_ADDRESSES = (process.env.TONE_POOLS ?? "").split(",").filter(Boolean);

const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

const READ_LOCALES = (process.env.TONE_LOCALES ?? "tr").split(",").filter(isLocale);

const OUTPUT_PATH = process.env.TONE_OUT ?? "explanations.json";

/** One minute per call is generous; four pools in two languages is not fast. */
const TIME_LIMIT_MS = 600_000;

const analyse = async (poolAddress: string) => {
  const graph = {
    poolAddress,
    apiKey: process.env.THE_GRAPH_API_KEY,
    subgraphId: process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
    fetchImpl: fetch,
  };

  const [pool, snapshot, history] = await Promise.all([
    fetchEthereumV3Pool({ ...graph, rpcUrl: process.env.ETHEREUM_RPC_URL }),
    fetchEthereumV3PoolMarketSnapshot({ ...graph, now: () => new Date() }),
    fetchEthereumV3DailyPriceHistory({ ...graph, now: () => new Date() }),
  ]);

  return analysePoolRange({ pool, snapshot, history, parameters: DEFAULT_PRICE_BAND_PARAMETERS });
};

describe.skipIf(POOL_ADDRESSES.length === 0)("live explanations", () => {
  it(
    "writes what the model says about each pool",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = resolveInterpretationModel(process.env.OPENAI_MODEL);
      const client = new OpenAI({ apiKey });
      const rows: unknown[] = [];

      for (const poolAddress of POOL_ADDRESSES) {
        const analysed = await analyse(poolAddress);

        if (analysed.status === "unavailable") {
          rows.push({ poolAddress, step: analysed.step, reason: analysed.reason });
          continue;
        }

        const analysis = analysed.data;
        const warnings = analysed.status === "partial" ? analysed.warnings : [];

        for (const locale of READ_LOCALES) {
          const startedAt = Date.now();
          const outcome = await interpretRange({
            analysis,
            warnings,
            locale,
            apiKey,
            model,
            createResponse: (params) =>
              client.responses.create(params as unknown as ResponseCreateParamsNonStreaming),
            onDiagnostic: (detail) => rows.push({ poolAddress, locale, rejected: detail }),
          });

          rows.push({
            poolAddress,
            locale,
            ms: Date.now() - startedAt,
            /* The facts the prose has to agree with, for reading beside it. */
            pair: `${analysis.pool.token0.symbol} / ${analysis.pool.token1.symbol}`,
            quotedAs: `${analysis.pool.token1.symbol} per ${analysis.pool.token0.symbol}`,
            belowRange: analysis.pool.token0.symbol,
            aboveRange: analysis.pool.token1.symbol,
            annualisedVolatility: analysis.volatility.annualizedVolatility,
            downsideDistance: analysis.band.downsideDistanceRatio,
            upsideDistance: analysis.band.upsideDistanceRatio,
            containsCurrentPrice: analysis.range.containsCurrentPrice,
            warnings,
            explanation:
              outcome.status === "success"
                ? { model: outcome.data.model, ...outcome.data.interpretation }
                : outcome,
          });
        }
      }

      writeFileSync(OUTPUT_PATH, JSON.stringify(rows, null, 2));
    },
    TIME_LIMIT_MS,
  );
});
