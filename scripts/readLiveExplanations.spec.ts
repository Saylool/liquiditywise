/*
 * A tool for reading — and measuring — what the model actually writes.
 *
 * Everything else about the explanation can be checked without a network: the
 * prompt is pure, the schema rejects a figure, and the transport is tested
 * against a stub. What none of that can tell you is whether the sentences are
 * any good, whether they agree with the page beside them, or whether the answer
 * fits in the room the contract gives it.
 *
 * That last part is not a matter of taste, and it is where every explanation
 * outage this project has had came from. All of them were invisible to the
 * suite and visible here in one run:
 *
 *   - A section bound of 700 characters, comfortable in English and not in
 *     Turkish, which refused whole answers in one of two published languages.
 *   - An output budget of 2048 tokens, justified by the length of the prose,
 *     which ignored that these models spend one to two thousand more tokens
 *     thinking before they write.
 *   - A default model the deployment's key is refused, so an unset setting
 *     would have produced an outage that read like the service being down.
 *
 * So this reports margins rather than only prose, and fails when one is gone.
 * The prose is written out either way — especially when the answer was refused,
 * which is exactly when you want to read it.
 *
 * It needs live pools and a real model, so it runs neither by default: with no
 * pools named it skips, and `npm test` stays hermetic.
 *
 *   NODE_USE_ENV_PROXY=1 TONE_POOLS=0x…,0x… TONE_LOCALES=tr,en \
 *     node --env-file=.env.local ./node_modules/vitest/vitest.mjs run \
 *     scripts/readLiveExplanations.spec.ts
 *
 * It calls the model directly rather than through `getRangeInterpretation`, so
 * an edited prompt is read back on the next run instead of an hour later.
 */

import { writeFileSync } from "node:fs";

import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { describe, expect, it } from "vitest";

import {
  analysePoolRange,
  DEFAULT_DEPOSIT_USD,
  DEFAULT_PRICE_BAND_PARAMETERS,
} from "../src/lib/advisor/poolRangeAnalysis";
import { interpretRange } from "../src/lib/ai/interpretRange";
import {
  DEFAULT_INTERPRETATION_MODEL,
  INTERPRETATION_MAX_TOKENS,
  resolveInterpretationModel,
} from "../src/lib/ai/interpretationModel";
import { LOCALES, type Locale } from "../src/lib/i18n/locales";
import { MAX_SECTION_CHARACTERS } from "../src/schemas";
import { fetchEthereumDailyPriceHistory } from "../src/lib/uniswap/ethereumDailyPriceHistory";
import { fetchEthereumV3Pool } from "../src/lib/uniswap/ethereumV3Pool";
import { fetchEthereumV4Pool } from "../src/lib/uniswap/ethereumV4Pool";
import { fetchEthereumPoolMarketSnapshot } from "../src/lib/uniswap/ethereumPoolMarketSnapshot";

const POOL_ADDRESSES = (process.env.TONE_POOLS ?? "").split(",").filter(Boolean);

const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

const READ_LOCALES = (process.env.TONE_LOCALES ?? "tr").split(",").filter(isLocale);

const OUTPUT_PATH = process.env.TONE_OUT ?? "explanations.json";

/**
 * The summary goes to its own file rather than to the console, because vitest
 * swallows `console.log` and a report nobody sees is a report nobody reads.
 */
const REPORT_PATH = process.env.TONE_REPORT ?? `${OUTPUT_PATH.replace(/\.json$/, "")}.report.txt`;

/** One minute per call is generous; four pools in two languages is not fast. */
const TIME_LIMIT_MS = 600_000;

/**
 * A v4 pool id is 66 characters and a v3 address is 42, so the list can carry
 * both and each is read through its own protocol's pool reader.
 */
const analyse = async (poolId: string) => {
  const protocolVersion = poolId.length === 66 ? ("v4" as const) : ("v3" as const);
  const graph = {
    apiKey: process.env.THE_GRAPH_API_KEY,
    subgraphId:
      protocolVersion === "v4"
        ? process.env.UNISWAP_V4_ETHEREUM_SUBGRAPH_ID
        : process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
    fetchImpl: fetch,
  };
  /** The two shared readers take a protocol and spell the id to match it. */
  const shared = { ...graph, protocolVersion, poolId, now: () => new Date() };

  const [pool, snapshot, history] = await Promise.all([
    protocolVersion === "v4"
      ? fetchEthereumV4Pool({ ...graph, poolId, rpcUrl: process.env.ETHEREUM_RPC_URL })
      : fetchEthereumV3Pool({ ...graph, poolAddress: poolId, rpcUrl: process.env.ETHEREUM_RPC_URL }),
    fetchEthereumPoolMarketSnapshot(shared),
    fetchEthereumDailyPriceHistory(shared),
  ]);

  return analysePoolRange({
    pool,
    snapshot,
    history,
    parameters: DEFAULT_PRICE_BAND_PARAMETERS,
    depositUsd: DEFAULT_DEPOSIT_USD,
  });
};

/** What one call spent, read off the provider's own accounting. */
type Spend = {
  readonly sections: Readonly<Record<string, number>>;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
};

/**
 * Reads the answer's own measurements out of the raw response.
 *
 * Done here, in the `createResponse` seam, because the outcome the caller gets
 * back carries a notice and not the text when an answer is refused — and a
 * refused answer is the one worth measuring.
 */
const measure = (response: unknown): Spend => {
  const bag = response as Record<string, unknown>;
  const usage = (bag.usage ?? {}) as Record<string, unknown>;
  const details = (usage.output_tokens_details ?? {}) as Record<string, unknown>;
  const text = typeof bag.output_text === "string" ? bag.output_text : "";

  const sections: Record<string, number> = {};
  try {
    for (const [name, prose] of Object.entries(JSON.parse(text) as Record<string, unknown>)) {
      if (typeof prose === "string" && name !== "method") sections[name] = prose.length;
    }
  } catch {
    sections["unparsed"] = text.length;
  }

  return {
    sections,
    outputTokens: Number(usage.output_tokens ?? 0),
    reasoningTokens: Number(details.reasoning_tokens ?? 0),
  };
};

const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

/**
 * One cheap call, to answer the question the rest of this run cannot: whether
 * the model a blank setting falls back to can be called at all.
 *
 * The configured model proves itself by writing the explanations below. The
 * default only proves itself if something asks it to, and nothing did — which is
 * how it stayed unreachable long enough to ship.
 */
const probeDefaultModel = async (client: OpenAI): Promise<string> => {
  try {
    await client.responses.create({
      model: DEFAULT_INTERPRETATION_MODEL,
      input: "ok",
      max_output_tokens: 16,
    } as unknown as ResponseCreateParamsNonStreaming);

    return "reachable";
  } catch (error) {
    const status = (error as { status?: unknown }).status;

    return `REFUSED (http ${String(status)})`;
  }
};

describe.skipIf(POOL_ADDRESSES.length === 0)("live explanations", () => {
  it(
    "reads what the model says about each pool, and what it had left to spare",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = resolveInterpretationModel(process.env.OPENAI_MODEL);
      const client = new OpenAI({ apiKey });
      const rows: unknown[] = [];
      const report: string[] = [];
      const failures: string[] = [];

      const defaultModelState = await probeDefaultModel(client);
      report.push(
        `model in use: ${model}`,
        `default if unset: ${DEFAULT_INTERPRETATION_MODEL} — ${defaultModelState}`,
        "",
      );
      if (defaultModelState !== "reachable") {
        failures.push(
          `the default model ${DEFAULT_INTERPRETATION_MODEL} is ${defaultModelState}: a blank or mistyped OPENAI_MODEL would take every explanation down`,
        );
      }

      let worstSection = { ratio: 0, label: "none" };
      let worstTokens = { ratio: 0, label: "none" };

      for (const poolAddress of POOL_ADDRESSES) {
        const analysed = await analyse(poolAddress);

        if (analysed.status === "unavailable") {
          rows.push({ poolAddress, step: analysed.step, reason: analysed.reason });
          report.push(`${poolAddress}: analysis stopped at ${analysed.step} (${analysed.reason})`);
          failures.push(`${poolAddress} did not analyse: ${analysed.step} / ${analysed.reason}`);
          continue;
        }

        const analysis = analysed.data;
        const warnings = analysed.status === "partial" ? analysed.warnings : [];

        for (const locale of READ_LOCALES) {
          const startedAt = Date.now();
          /*
           * A holder rather than a plain `let`: the assignment happens inside a
           * callback, and control-flow narrowing cannot see that it ran, so a
           * variable would be read back as `never`.
           */
          const captured: { value?: Spend } = {};

          const outcome = await interpretRange({
            analysis,
            warnings,
            locale,
            apiKey,
            model,
            createResponse: async (params) => {
              const response = await client.responses.create(
                params as unknown as ResponseCreateParamsNonStreaming,
              );
              captured.value = measure(response);
              return response;
            },
            onDiagnostic: (detail) => rows.push({ poolAddress, locale, rejected: detail }),
          });

          const spend = captured.value;
          const where = `${poolAddress.slice(0, 8)}… ${locale}`;
          const lengths = Object.entries(spend?.sections ?? {});
          const longest = lengths.reduce(
            (worst, [name, length]) => (length > worst[1] ? [name, length] : worst),
            ["none", 0] as [string, number],
          );

          if (longest[1] / MAX_SECTION_CHARACTERS > worstSection.ratio) {
            worstSection = {
              ratio: longest[1] / MAX_SECTION_CHARACTERS,
              label: `${where} ${longest[0]} at ${longest[1]} of ${MAX_SECTION_CHARACTERS}`,
            };
          }

          const tokens = spend?.outputTokens ?? 0;
          if (tokens / INTERPRETATION_MAX_TOKENS > worstTokens.ratio) {
            worstTokens = {
              ratio: tokens / INTERPRETATION_MAX_TOKENS,
              label: `${where} at ${tokens} of ${INTERPRETATION_MAX_TOKENS}`,
            };
          }

          report.push(
            `${where}  ${outcome.status === "success" ? "ok     " : "REFUSED"}  ` +
              `sections ${lengths.map(([, length]) => length).join("/")} ` +
              `(worst ${percent(longest[1], MAX_SECTION_CHARACTERS)} of bound)  ` +
              `tokens ${tokens} (${percent(tokens, INTERPRETATION_MAX_TOKENS)} of budget, ` +
              `${spend?.reasoningTokens ?? 0} reasoning)`,
          );

          if (outcome.status !== "success") {
            failures.push(`${where} was refused: ${outcome.notice}`);
          }

          rows.push({
            poolAddress,
            locale,
            ms: Date.now() - startedAt,
            spend,
            /* The facts the prose has to agree with, for reading beside it. */
            pair: `${analysis.pool.token0.symbol} / ${analysis.pool.token1.symbol}`,
            quotedAs: `${analysis.pool.token1.symbol} per ${analysis.pool.token0.symbol}`,
            belowRange: analysis.pool.token0.symbol,
            aboveRange: analysis.pool.token1.symbol,
            annualisedVolatility: analysis.volatility.annualizedVolatility,
            downsideDistance: analysis.band.downsideDistanceRatio,
            upsideDistance: analysis.band.upsideDistanceRatio,
            containsCurrentPrice: analysis.range.containsCurrentPrice,
            /*
             * Whether the page has a check the prose must not deny, and how it
             * came out. The prose is read beside this: a text saying there is no
             * independent check, printed under a panel showing one, is the
             * failure this row exists to make visible.
             */
            outOfSample:
              analysis.outOfSample.status === "success"
                ? {
                    folds: analysis.outOfSample.data.folds.length,
                    daysMeasured: analysis.outOfSample.data.daysMeasured,
                    daysInside: analysis.outOfSample.data.occupancy.fullyInside,
                  }
                : analysis.outOfSample.notice,
            warnings,
            explanation:
              outcome.status === "success"
                ? { model: outcome.data.model, ...outcome.data.interpretation }
                : outcome,
          });
        }
      }

      report.push(
        "",
        `worst section margin: ${worstSection.label}`,
        `worst token margin:   ${worstTokens.label}`,
      );

      writeFileSync(OUTPUT_PATH, JSON.stringify(rows, null, 2));
      writeFileSync(
        REPORT_PATH,
        [...report, "", failures.length === 0 ? "no margins gone" : "FAILURES", ...failures, ""].join(
          "\n",
        ),
      );

      expect(failures).toEqual([]);
    },
    TIME_LIMIT_MS,
  );
});
