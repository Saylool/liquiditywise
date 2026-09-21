import { describe, expect, it } from "vitest";

import { VOLATILITY_WINDOW_DAYS } from "../../schemas";
import { isDormant, normalizePoolCard, type PoolCard } from "./v3PoolCardAdapter";

const DAY = 86_400;
/** 2026-09-21T10:00:00Z; the current UTC day starts at 1789948800. */
const NOW = new Date("2026-09-21T10:00:00.000Z");
const TODAY = 1_789_948_800;

const card = (lastActiveDay: number | null): PoolCard =>
  ({ lastActiveDay }) as unknown as PoolCard;

describe("isDormant", () => {
  it("keeps a pool active today, and one active on the last day the window covers", () => {
    expect(isDormant(card(TODAY), NOW)).toBe(false);
    expect(isDormant(card(TODAY - VOLATILITY_WINDOW_DAYS * DAY), NOW)).toBe(false);
  });

  it("drops a pool whose last day is one day past the window, and one with no day at all", () => {
    expect(isDormant(card(TODAY - (VOLATILITY_WINDOW_DAYS + 1) * DAY), NOW)).toBe(true);
    expect(isDormant(card(null), NOW)).toBe(true);
  });

  it("measures from the start of the current UTC day, not from the moment", () => {
    /* Late in the day the boundary is the same as early in the day. */
    const late = new Date("2026-09-21T23:59:59.000Z");
    const edge = TODAY - VOLATILITY_WINDOW_DAYS * DAY;
    expect(isDormant(card(edge), late)).toBe(false);
    expect(isDormant(card(edge - DAY), late)).toBe(true);
  });

  it("drops the SYRUP/USDC pool that started this: last active 2026-03-13", () => {
    expect(isDormant(card(1_773_360_000), NOW)).toBe(true);
  });
});

describe("normalizePoolCard's last active day", () => {
  const raw = (poolDayData: { date: number }[]) => ({
    id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
    feeTier: "500",
    totalValueLockedUSD: "1",
    poolDayData,
    token0: { id: "0x1111111111111111111111111111111111111111", symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
    token1: { id: "0x2222222222222222222222222222222222222222", symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
  });

  it("reads the day when there is one, and null when there is none", () => {
    expect(normalizePoolCard(raw([{ date: TODAY }]))?.lastActiveDay).toBe(TODAY);
    expect(normalizePoolCard(raw([]))?.lastActiveDay).toBeNull();
  });

  it("treats a negative day as no day", () => {
    expect(normalizePoolCard(raw([{ date: -1 }]))?.lastActiveDay).toBeNull();
  });
});
