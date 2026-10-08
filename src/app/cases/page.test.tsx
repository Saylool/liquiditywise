import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
 * The page's metadata names the chain off mainnet, and the page shows what
 * is kept — never starting a measurement for a visit.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/requestLocale", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    getRequestDictionary: async () => ({ locale: "en", t: getDictionary("en") }),
    getOpenPageAlternates: async (path: string) => ({ canonical: path, languages: {} }),
  };
});

const state = vi.hoisted(() => ({ kept: null as unknown, measured: 0, read: [] as number[] }));
vi.mock("@/lib/advisor/getMonthCases", () => ({
  getKeptMonthCases: async (chainId: number) => {
    state.read.push(chainId);
    return state.kept;
  },
  getMonthCases: async () => {
    state.measured += 1;
    throw new Error("a page must never measure");
  },
}));

import CasesPage, { generateMetadata } from "./page";

const params = (chain?: string) => ({ searchParams: Promise.resolve(chain === undefined ? {} : { chain }) });

describe("the cases page's metadata", () => {
  it("names a chain off mainnet in its title and description, and refuses an unknown one a name", async () => {
    expect((await generateMetadata(params())).title).toBe(
      "This month, measured: what the busiest Uniswap pools' ranges did over the last thirty days · LiquidityWise",
    );
    expect((await generateMetadata(params("base"))).title).toContain("This month on Base, measured");
    expect((await generateMetadata(params("base"))).description).toContain("on Base");
    expect((await generateMetadata(params("solana"))).title).not.toContain("solana");
    expect((await generateMetadata(params())).alternates).toEqual({ canonical: "/cases", languages: {} });
  });
});

describe("the cases page", () => {
  it("shows what is kept for the chain asked, and measures nothing", async () => {
    state.kept = null;
    const markup = renderToStaticMarkup(await CasesPage(params("arbitrum")));

    expect(state.read).toEqual([42161]);
    expect(state.measured).toBe(0);
    expect(markup).toContain("The month on Arbitrum One has not been measured yet.");
    expect(markup).toContain("This month, measured");
  });

  it("tells a reader a network nobody reads is not read, instead of showing mainnet's month", async () => {
    const markup = renderToStaticMarkup(await CasesPage(params("solana")));

    expect(markup).toContain("LiquidityWise does not read that network.");
    expect(markup).not.toContain("has not been measured yet");
  });
});
