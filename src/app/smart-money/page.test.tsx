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
    expect(await titleOn("arbitrum")).toContain("on Arbitrum One");
    expect(await titleOn("unichain")).not.toContain("Unichain");
    expect(await titleOn("solana")).not.toContain("solana");
  });

  it("carries a share card where it reads positions, drawn for that chain, and none elsewhere", async () => {
    const cards = async (chain?: string) => {
      const metadata = await generateMetadata({ searchParams: Promise.resolve(chain === undefined ? {} : { chain }) });
      return (metadata.openGraph?.images as { url: string }[] | undefined)?.map(({ url }) => url);
    };

    expect(await cards()).toEqual(["/og/smart"]);
    expect(await cards("polygon")).toEqual(["/og/smart?chain=polygon"]);
    expect(await cards("arbitrum")).toEqual(["/og/smart?chain=arbitrum"]);
    expect(await cards("unichain")).toBeUndefined();
    expect(await cards("solana")).toBeUndefined();
  });
});
