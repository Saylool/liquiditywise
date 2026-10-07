import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WeeklyReading } from "@/lib/telegram/weeklyDigest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/requestLocale", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    getRequestDictionary: async () => ({ locale: "en", t: getDictionary("en") }),
    getOpenPageAlternates: async (path: string) => ({ canonical: path, languages: {} }),
  };
});

const state = vi.hoisted(() => ({ reading: null as WeeklyReading | null, asked: [] as number[] }));

vi.mock("@/lib/advisor/getWeeklyDigest", () => ({
  getWeeklyReading: async (chainId: number) => {
    state.asked.push(chainId);
    return state.reading;
  },
}));
vi.mock("@/lib/telegram/environment", () => ({ publicBot: () => null }));

import WeeklyPage, { generateMetadata } from "./page";
import { getChainCopy } from "@/lib/i18n/chainCopy";
import { getWeeklyCopy } from "@/lib/i18n/weeklyCopy";

const metadata = async (chain?: string) => generateMetadata({ searchParams: Promise.resolve(chain === undefined ? {} : { chain }) });
const page = async (chain?: string) => renderToStaticMarkup(await WeeklyPage({ searchParams: Promise.resolve(chain === undefined ? {} : { chain }) }));

describe("the weekly page's metadata", () => {
  it("names a chain whose positions it reads in the title, and not one whose it cannot", async () => {
    expect((await metadata()).title).toBe("Where the smart money moved this week · LiquidityWise");
    expect((await metadata("polygon")).title).toContain("on Polygon");
    expect((await metadata("arbitrum")).title).toContain("on Arbitrum One");
    expect((await metadata("unichain")).title).not.toContain("Unichain");
    expect((await metadata("solana")).title).not.toContain("solana");
    expect((await metadata()).description).toBe(getWeeklyCopy("en").description);
  });

  it("names its own address in every language", async () => {
    expect((await metadata()).alternates).toEqual({ canonical: "/weekly", languages: {} });
  });

  it("carries the smart-money card for the chain where it reads positions, and none elsewhere", async () => {
    const cards = async (chain?: string) => ((await metadata(chain)).openGraph?.images as { url: string }[] | undefined)?.map(({ url }) => url);

    expect(await cards()).toEqual(["/og/smart"]);
    expect(await cards("base")).toEqual(["/og/smart?chain=base"]);
    expect(await cards("unichain")).toBeUndefined();
    expect(await cards("solana")).toBeUndefined();
  });
});

describe("the weekly page", () => {
  it("says so for a chain nobody reads, and asks the store nothing", async () => {
    state.asked = [];
    const html = await page("solana");

    expect(html).toContain(getChainCopy("en").unknown);
    expect(state.asked).toEqual([]);
  });

  it("reads the week of the chain asked for, and leads to that chain's smart-money page", async () => {
    state.asked = [];
    state.reading = { status: "quiet", window: { from: "2026-09-28T09:00:00.000Z", to: "2026-10-05T06:00:00.000Z", days: 6.875 }, topYields: [] };
    const html = await page("base");

    expect(state.asked).toEqual([8453]);
    expect(html).toContain('href="/en/smart-money?chain=base"');
    expect(html).toContain("2026-09-28 09:00 UTC");
    /* React escapes the apostrophe in the heading. */
    expect(html).toContain(`<h1>${getWeeklyCopy("en").heading.replace(/'/g, "&#x27;")}</h1>`);
  });

  it("is mainnet's week when no chain is named", async () => {
    state.asked = [];
    await page();

    expect(state.asked).toEqual([1]);
  });
});
