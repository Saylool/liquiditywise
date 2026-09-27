import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ data: null as unknown, chains: [] as unknown[] }));
vi.mock("@/lib/advisor/getMostTraded", () => ({
  getMostTraded: async (chainId: unknown) => {
    state.chains.push(chainId);
    return state.data;
  },
}));

import { getDictionary } from "@/lib/i18n/dictionaries";
import { HomeMostTraded } from "./HomeMostTraded";

const pool = {
  pool: {
    protocolVersion: "v3",
    chainId: 1,
    id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
    feePpm: 500,
    token0: { chainId: 1, symbol: "USDC", decimals: 6, address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
    token1: { chainId: 1, symbol: "WETH", decimals: 18, address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  },
  volumeUsd: 1_000_000,
  feesUsd: 500,
  daysCounted: 7,
  hookAltersSwaps: false,
};

const render = async (locale: "en" | "tr" = "tr") => {
  const element = await HomeMostTraded({ locale, t: getDictionary(locale) });
  return element === null ? "" : renderToStaticMarkup(element);
};

beforeEach(() => {
  state.chains = [];
});

describe("the week's pools on the front page", () => {
  it("reads mainnet's list and leads on to the whole page at the language's address", async () => {
    state.data = { v3: { status: "listed", pools: [pool], fetchedAt: "x" }, v4: null };
    const html = await render();

    expect(state.chains).toEqual([1]);
    expect(html).toContain("USDC / WETH");
    expect(html).toContain('href="/tr/most-traded"');
  });

  it("shows nothing at all when neither half has a pool to show", async () => {
    state.data = { v3: { status: "unavailable", notice: "market-data-timed-out" }, v4: { status: "listed", pools: [], fetchedAt: "x" } };

    expect(await render()).toBe("");
  });
});
