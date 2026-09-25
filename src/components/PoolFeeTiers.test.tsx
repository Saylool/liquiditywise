import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import type { DataResult, PairFeeTiers } from "../schemas";
import { PoolFeeTiers } from "./PoolFeeTiers";

const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const WETH = "0x4200000000000000000000000000000000000006";
const ANALYSED = `0x${"a".repeat(40)}`;
const OTHER = `0x${"b".repeat(40)}`;

const tier = (id: string, chainId: number, feePpm: number) => ({
  pool: {
    protocolVersion: "v3" as const,
    chainId,
    id,
    token0: { chainId, symbol: "WETH", decimals: 18, address: WETH },
    token1: { chainId, symbol: "USDC", decimals: 6, address: USDC },
    feePpm,
  },
  reserves: null,
});

const tiers = (chainId: number): DataResult<PairFeeTiers> => ({
  status: "success",
  data: {
    analysedPoolId: ANALYSED,
    tiers: [tier(ANALYSED, chainId, 500), tier(OTHER, chainId, 3000)],
    fetchedAt: "2026-09-25T00:00:00.000Z",
    sources: ["uniswap-v3-subgraph"],
  } as unknown as PairFeeTiers,
});

const render = (chainId: number) =>
  renderToStaticMarkup(
    <PoolFeeTiers
      result={tiers(chainId)}
      v4Result={chainId === 1 ? { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } : null}
      pair="WETH / USDC"
      parameters={{ horizonDays: 30, standardDeviationMultiplier: 1 }}
      depositUsd={1_000}
      t={getDictionary("en")}
      locale="en"
    />,
  );

describe("the pair's other tiers, off mainnet", () => {
  it("links each tier on the same chain", () => {
    expect(render(8453)).toContain(`/pool?chain=base&amp;address=${OTHER}`);
  });

  it("says nothing of v4, which is read on mainnet alone", () => {
    expect(render(8453)).not.toContain("On Uniswap v4");
    expect(render(1)).toContain("On Uniswap v4");
  });

  it("offers the side-by-side comparison on the pool's own chain", () => {
    expect(render(1)).toContain(`/compare?address=${ANALYSED}`);
    expect(render(42161)).toContain(`/compare?chain=arbitrum&amp;address=${ANALYSED}`);
  });
});
