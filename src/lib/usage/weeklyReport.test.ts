import { describe, expect, it } from "vitest";

import { MODEL_PRICES, priceOf } from "../ai/modelPrices";
import { INTERPRETATION_MODELS } from "../ai/interpretationModel";
import { parseUsageLine, spendLine, visitLine, type UsageLine, type Visit } from "./usageLines";
import { weeklyReport } from "./weeklyReport";

const USDC_WETH = "v3:0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const OTHER = "v3:0xcbcdf9626bc03e24f779434178a73a0b4bad62ed";

const at = (day: string, line: string): UsageLine => {
  const parsed = parseUsageLine(`${day}T10:00:00+0000 srv npm[1]: ${line}`);
  if (parsed === null) throw new Error(`not a usage line: ${line}`);
  return parsed;
};

const opened = (day: string, visit: Partial<Visit> = {}): UsageLine =>
  at(day, visitLine({ page: "/pool", pool: USDC_WETH, locale: "en", bot: false, outcome: "served", ...visit }));

const spent = (day: string, model = "gpt-5.6-luna", input = 2_000, output = 500): UsageLine =>
  at(day, spendLine({ model, inputTokens: input, outputTokens: output, pool: USDC_WETH, pair: "USDC/WETH" }));

const report = (lines: readonly UsageLine[], telegramLinks: number | null = 0) =>
  weeklyReport({ lines, from: "2026-09-17", to: "2026-09-23", telegramLinks, priceOf });

describe("the weekly report", () => {
  it("says a quiet week was quiet rather than sending an empty message", () => {
    const text = report([]);

    expect(text).toContain("📊 LiquidityWise · the week of 17 Sep – 23 Sep");
    expect(text).toContain("No page was opened this week");
    expect(text).toContain("Explanations written: none");
    expect(text).toContain("Telegram: 0 chats following an address");
  });

  it("counts people and bots apart, and pages by what they are", () => {
    const text = report([
      opened("2026-09-18"),
      opened("2026-09-18", { page: "/v4", pool: null }),
      opened("2026-09-19", { page: "/", pool: null }),
      opened("2026-09-19", { bot: true }),
      opened("2026-09-19", { bot: true, page: "/hooks", pool: null }),
    ]);

    expect(text).toContain("Pages opened by people: 3 (and 2 by bots)");
    expect(text).toContain("  home 1 · v3 pool 1 · v4 pool 1");
  });

  it("names the pools it knows the pair of, and shortens the rest", () => {
    const text = report([opened("2026-09-18"), opened("2026-09-18"), opened("2026-09-19", { pool: OTHER }), spent("2026-09-18")]);

    expect(text).toContain("Pools opened: 2 different. Most: USDC/WETH (v3) 2, 0xcbcd…62ed (v3) 1");
  });

  it("tells apart two pools of one pair by their address, and only then", () => {
    const tier = "v3:0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";
    const text = report([
      opened("2026-09-18"),
      opened("2026-09-18", { pool: tier }),
      spent("2026-09-18"),
      at("2026-09-18", spendLine({ model: "gpt-5.6-luna", inputTokens: 1, outputTokens: 1, pool: tier, pair: "USDC/WETH" })),
    ]);

    expect(text).toContain("Most: USDC/WETH (v3, 0x88e6…5640) 1, USDC/WETH (v3, 0x8ad5…e6d8) 1");
  });

  it("counts searches without saying what was searched, and not as a pool", () => {
    const text = report([opened("2026-09-18", { pool: "search" })]);

    expect(text).toContain("Searches: 1");
    expect(text).not.toContain("Pools opened");
  });

  it("adds up what the explanations cost, at each model's own price", () => {
    const text = report([spent("2026-09-18", "gpt-5.6-luna", 1_000_000, 1_000_000), spent("2026-09-18", "gpt-5.6-terra", 1_000_000, 0)]);

    // luna: $0.20 + $1.20; terra: $2.00
    expect(text).toContain("Explanations written: 2 (gpt-5.6-luna, gpt-5.6-terra) — 2,000,000 tokens in, 1,000,000 out, about $3.40");
  });

  it("says when a model has no price on file rather than counting it as free", () => {
    expect(report([spent("2026-09-18", "gpt-7-unknown")])).toContain("about $0.0000 plus 1 on a model with no price on file");
  });

  it("shows a small week's cost to a hundredth of a cent, not as nothing", () => {
    // 2,412 × $0.20 + 731 × $1.20, per million: $0.0014
    expect(report([spent("2026-09-18", "gpt-5.6-luna", 2_412, 731)])).toContain("about $0.0014");
  });

  it("reports turned-away requests, rejected answers and the store not answering", () => {
    const text = report(
      [opened("2026-09-18", { outcome: "refused" }), at("2026-09-18", "[interpretation] answer rejected — a digit")],
      null,
    );

    expect(text).toContain("Turned away by the rate limit: 1");
    expect(text).toContain("Pages opened by people: 0");
    expect(text).toContain("Answers the checks turned down: 1");
    expect(text).toContain("Telegram: the store could not be asked");
  });

  it("names the busiest day, and languages most first", () => {
    const text = report([
      opened("2026-09-18", { locale: "tr" }),
      opened("2026-09-18", { locale: "tr" }),
      opened("2026-09-20", { locale: "en" }),
    ]);

    expect(text).toContain("Busiest day: Fri 18 Sep, 2 pages");
    expect(text).toContain("Languages: tr 2 · en 1");
  });
});

describe("the prices the report multiplies", () => {
  it("has one for every model the application may call", () => {
    expect(Object.keys(MODEL_PRICES).sort()).toEqual(Object.keys(INTERPRETATION_MODELS).sort());
  });

  it("charges a dated build as its alias, and knows nothing of another model", () => {
    expect(priceOf("gpt-5.6-luna-2026-08-01")).toEqual(MODEL_PRICES["gpt-5.6-luna"]);
    expect(priceOf("gpt-5.6")).toBeNull();
  });
});
