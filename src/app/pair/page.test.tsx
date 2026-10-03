import { describe, expect, it, vi } from "vitest";

/*
 * The pair page reads six networks for one request, so what it refuses to
 * read matters as much as what it reads: nothing for a refused term, one
 * symbol or a pool's own id, and the validated pair — never the raw string —
 * for anything else.
 */

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ asked: [] as unknown[] }));

vi.mock("@/lib/i18n/requestLocale", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return { getRequestDictionary: async () => ({ locale: "en", t: getDictionary("en") }) };
});
vi.mock("@/components/WorkspaceShell", () => ({ WorkspaceShell: () => null }));
vi.mock("@/lib/advisor/getPairPools", () => ({
  getPairPools: async (terms: unknown) => {
    state.asked.push(terms);
    return { terms, v3: { ranked: [], unranked: [], chains: [] }, v4: { ranked: [], unranked: [], chains: [] } };
  },
}));

import PairPage, { generateMetadata } from "./page";

const open = (q?: string | string[]) => PairPage({ searchParams: Promise.resolve(q === undefined ? {} : { q }) });

describe("the pair page", () => {
  it("is closed to crawlers, and names the pair it was asked about", async () => {
    const asked = await generateMetadata({ searchParams: Promise.resolve({ q: "usdc-weth" }) });
    const empty = await generateMetadata({ searchParams: Promise.resolve({}) });

    expect(asked.robots).toEqual({ index: false, follow: false });
    expect(asked.title).toBe("Every Uniswap pool of usdc/weth, on every network · LiquidityWise");
    expect(empty.title).toBe("Every Uniswap pool of a pair, on every network · LiquidityWise");
  });

  it("reads nothing without a pair", async () => {
    state.asked = [];
    for (const q of [undefined, "", "USDC", "usdc/USDC", "$USDC/WETH", `0x${"1".repeat(40)}`, ["USDC/WETH", "DAI/WETH"]]) {
      await open(q);
    }

    expect(state.asked).toEqual([]);
  });

  it("reads the pair the search box's rules make of what was typed", async () => {
    state.asked = [];
    await open(" WETH / USDC 0.05% ");
    await open("WETH USDC");

    expect(state.asked).toEqual([
      ["WETH", "USDC"],
      ["WETH", "USDC"],
    ]);
  });
});
