import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/requestLocale", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    getRequestDictionary: async () => ({ locale: "en", t: getDictionary("en") }),
    getOpenPageAlternates: async (path: string) => ({ canonical: path, languages: {} }),
  };
});
vi.mock("@/lib/advisor/getSmartLiquidity", () => ({ getSmartLiquidity: async () => null }));

import { generateMetadata } from "./page";

const titleOn = async (chain?: string) =>
  (await generateMetadata({ searchParams: Promise.resolve(chain === undefined ? {} : { chain }) })).title;

describe("the smart-money page's title", () => {
  it("names a chain whose positions it reads, and not one whose it cannot", async () => {
    expect(await titleOn()).toBe("Where the best-earning Uniswap liquidity providers put their money · LiquidityWise");
    expect(await titleOn("polygon")).toContain("on Polygon");
    expect(await titleOn("arbitrum")).not.toContain("Arbitrum");
    expect(await titleOn("solana")).not.toContain("solana");
  });
});
