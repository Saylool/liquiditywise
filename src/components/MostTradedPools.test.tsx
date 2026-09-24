import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MostTradedPool } from "../lib/advisor/mostTraded";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import type { MostTraded } from "../lib/advisor/readMostTraded";
import { getDictionary } from "../lib/i18n/dictionaries";
import { getMostTradedCopy } from "../lib/i18n/mostTradedCopy";
import { MostTradedPools } from "./MostTradedPools";

const token = (symbol: string, address: string) => ({ chainId: 1, symbol, decimals: 18, address });
const V3_ID = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const V4_ID = `0x${"e5".repeat(32)}`;

const v3: MostTradedPool = {
  pool: {
    protocolVersion: "v3",
    chainId: 1,
    id: V3_ID,
    token0: token("USDC", `0x${"1".repeat(40)}`),
    token1: token("WETH", `0x${"2".repeat(40)}`),
    feePpm: 500,
  },
  volumeUsd: 1_234_567,
  feesUsd: 617.28,
  daysCounted: 7,
  hookAltersSwaps: false,
};

const v4: MostTradedPool = {
  pool: {
    protocolVersion: "v4",
    chainId: 1,
    id: V4_ID,
    token0: token("ETH", `0x${"0".repeat(40)}`),
    token1: token("USDC", `0x${"1".repeat(40)}`),
    tickSpacing: 10,
    fee: { kind: "dynamic", currentFeePpm: null },
    protocolFee: null,
    hookAddress: `0x${"1".repeat(36)}0080`,
  },
  volumeUsd: 800_000,
  feesUsd: null,
  daysCounted: 5,
  hookAltersSwaps: true,
};

const render = (data: MostTraded, locale: "en" | "tr" = "en") =>
  renderToStaticMarkup(
    <MostTradedPools
      data={data}
      copy={getMostTradedCopy(locale)}
      parameters={DEFAULT_PRICE_BAND_PARAMETERS}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

const both: MostTraded = {
  v3: { status: "listed", pools: [v3], fetchedAt: "2026-09-24T12:00:00.000Z" },
  v4: { status: "listed", pools: [v4], fetchedAt: "2026-09-24T12:00:00.000Z" },
};

describe("the most-traded page", () => {
  it("says what the order is and is not before any pool", () => {
    const markup = render(both);

    expect(markup.indexOf("none of these is a recommendation")).toBeGreaterThan(-1);
    expect(markup.indexOf("none of these is a recommendation")).toBeLessThan(markup.indexOf("USDC / WETH"));
  });

  it("keeps v3 and v4 apart, each under its own heading", () => {
    const markup = render(both);

    expect(markup.indexOf("On Uniswap v3")).toBeLessThan(markup.indexOf("USDC / WETH"));
    expect(markup.indexOf("On Uniswap v4")).toBeGreaterThan(markup.indexOf("USDC / WETH"));
    expect(markup.indexOf("ETH / USDC")).toBeGreaterThan(markup.indexOf("On Uniswap v4"));
  });

  it("shows each pool's week: what it traded and charged, and of how many days", () => {
    const markup = render(both);

    expect(markup).toContain("$1,234,567");
    expect(markup).toContain("$617.28");
    expect(markup).toContain("7 of 7 days");
    expect(markup).toContain("5 of 7 days");
  });

  it("says a fee could not be read rather than printing one, and notes a hook that may change swap costs", () => {
    const markup = render(both);

    expect(markup).toContain("could not be read");
    expect(markup).toContain("hook: may change what a swap costs");
    expect(markup.split("hook: may change what a swap costs")).toHaveLength(2);
  });

  it("labels the fee as the pool's: a v3 tier, a v4 hook's dynamic fee with its price step", () => {
    const markup = render(both);

    expect(markup).toContain("0.05%");
    expect(markup).toContain("Set by the hook, per swap · step 0.10%");
  });

  it("leads into each pool's own analysis", () => {
    const markup = render(both);

    expect(markup).toContain(`/pool?address=${V3_ID}`);
    expect(markup).toContain(`/v4?id=${V4_ID}`);
  });

  it("says why a half is missing, in the reader's language, and keeps the other", () => {
    const markup = render(
      { v3: { status: "unavailable", notice: "market-data-timed-out" }, v4: both.v4 },
      "tr",
    );

    expect(markup).toContain("Bu haftanın havuzları şu an okunamadı.");
    expect(markup).toContain("ETH / USDC");
  });

  it("says so when a half has no pools at all", () => {
    expect(render({ v3: { status: "listed", pools: [], fetchedAt: "x" }, v4: both.v4 })).toContain(
      "No pool traded in this window.",
    );
  });
});
