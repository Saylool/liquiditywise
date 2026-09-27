import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  analysed: [] as unknown[][],
  warmed: [] as { locale: string; warnings: unknown }[],
  unread: new Set<string>(),
  partial: new Set<string>(),
  data: null as unknown,
}));
vi.mock("./getMostTraded", () => ({ getMostTraded: async (chainId: unknown) => (chainId === 1 ? state.data : null) }));
vi.mock("./getPoolRangeAnalysis", () => ({
  getPoolRangeAnalysis: async (protocol: string, id: string, parameters: unknown, deposit: unknown, poolRead: unknown, chainId: unknown) => {
    state.analysed.push([protocol, id, parameters, deposit, poolRead, chainId]);
    if (state.unread.has(id)) return { status: "unavailable", notice: "market-data-timed-out" };
    return state.partial.has(id)
      ? { status: "partial", data: { id }, warnings: ["history-incomplete"] }
      : { status: "success", data: { id } };
  },
}));
vi.mock("../ai/getRangeInterpretation", () => ({
  warmRangeInterpretation: async (request: { locale: string; warnings: unknown }) => {
    state.warmed.push({ locale: request.locale, warnings: request.warnings });
    return "written";
  },
}));

import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";
import { warmFrontPageExplanations } from "./warmExplanations";

const listed = (protocol: string, count: number) => ({
  status: "listed",
  fetchedAt: "x",
  pools: Array.from({ length: count }, (_, index) => ({ pool: { protocolVersion: protocol, id: `${protocol}-${index}` } })),
});

beforeEach(() => {
  state.analysed = [];
  state.warmed = [];
  state.unread = new Set();
  state.partial = new Set();
});

describe("writing the front page's explanations ahead", () => {
  it("analyses the front page's pools as a reader opens them, and warms each in English", async () => {
    state.data = { v3: listed("v3", 5), v4: listed("v4", 5) };
    const outcomes = await warmFrontPageExplanations();

    expect(state.analysed.map(([protocol, id]) => `${protocol}:${id}`)).toEqual([
      "v3:v3-0", "v3:v3-1", "v3:v3-2", "v4:v4-0", "v4:v4-1", "v4:v4-2",
    ]);
    expect(state.analysed[0]?.slice(2)).toEqual([DEFAULT_PRICE_BAND_PARAMETERS, DEFAULT_DEPOSIT_USD, undefined, 1]);
    expect(state.warmed.every(({ locale }) => locale === "en")).toBe(true);
    expect(outcomes).toHaveLength(6);
  });

  it("passes a partial analysis's warnings on, and skips a pool that could not be analysed", async () => {
    state.data = { v3: listed("v3", 2), v4: null };
    state.unread.add("v3-0");
    state.partial.add("v3-1");
    const outcomes = await warmFrontPageExplanations();

    expect(outcomes).toEqual(["unread", "written"]);
    expect(state.warmed).toEqual([{ locale: "en", warnings: ["history-incomplete"] }]);
  });

  it("warms nothing when the week's list could not be read", async () => {
    state.data = { v3: { status: "unavailable", notice: "market-data-timed-out" }, v4: null };

    expect(await warmFrontPageExplanations()).toEqual([]);
  });
});
