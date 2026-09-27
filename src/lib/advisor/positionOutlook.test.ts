import { describe, expect, it } from "vitest";

import type { PoolDailyPriceHistory, Position } from "../../schemas";
import { projectLogSymmetricBand } from "../analytics/logSymmetricBand";
import { calculateHistoricalVolatility } from "../analytics/historicalVolatility";
import { takeRecentDays } from "../analytics/dailyHistoryWindows";
import { priceAtTick } from "../uniswap/v3TickMath";
import { positionOutlook } from "./positionOutlook";

const DAY_MS = 86_400_000;
const POOL_ID = `0x${"ab".repeat(20)}`;
const END = Date.parse("2026-09-27T00:00:00.000Z");

/** A day's close with its own high and low around it. */
const point = (daysBeforeEnd: number, low: number, high: number) => ({
  timestamp: new Date(END - daysBeforeEnd * DAY_MS).toISOString(),
  price: (low + high) / 2,
  low,
  high,
  volumeUsd: null,
  feesUsd: null,
  activeLiquidity: null,
});

/** Forty days, oldest first, each drawn by `dayAt` from how many days before the end it is. */
const history = (dayAt: (daysBeforeEnd: number) => [number, number], pool = POOL_ID): PoolDailyPriceHistory =>
  ({
    pool: { protocolVersion: "v3", chainId: 1, id: pool },
    fetchedAt: "2026-09-27T09:00:00.000Z",
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-09-27T08:59:48.000Z",
    rangeStart: new Date(END - 40 * DAY_MS).toISOString(),
    rangeEndExclusive: new Date(END).toISOString(),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points: Array.from({ length: 40 }, (_, index) => {
      const daysBeforeEnd = 40 - index;
      return point(daysBeforeEnd, ...dayAt(daysBeforeEnd));
    }),
    source: "uniswap-v3-subgraph",
  }) as PoolDailyPriceHistory;

const position = (overrides: Partial<Position> = {}): Position =>
  ({
    tokenId: "1",
    pool: {
      protocolVersion: "v3",
      chainId: 1,
      id: POOL_ID,
      feePpm: 500,
      token0: { chainId: 1, address: `0x${"1".repeat(40)}`, symbol: "A", decimals: 18 },
      token1: { chainId: 1, address: `0x${"2".repeat(40)}`, symbol: "B", decimals: 18 },
    },
    tickLower: 0,
    tickUpper: 1000,
    lowerPrice: 90,
    upperPrice: 110,
    liquidity: "1",
    currentTick: 46_000,
    inRange: true,
    uncollected: null,
    ...overrides,
  }) as Position;

const PARAMETERS = { horizonDays: 30, standardDeviationMultiplier: 1 };

describe("how an open position has fared", () => {
  it("counts the last thirty days inside, outside and across an edge, as the pool page counts them", () => {
    /* The last thirty: 12 wholly inside, 10 wholly outside, 8 across the upper edge; the ten before them do not count. */
    const days = history((before) =>
      before > 30 ? [200, 210] : before > 18 ? [95, 105] : before > 8 ? [120, 130] : [100, 115],
    );
    const outlook = positionOutlook({ position: position(), history: days, parameters: PARAMETERS });

    expect(outlook).toMatchObject({ days: 30, inside: 12, outside: 10, crossed: 8 });
  });

  it("draws the suggested range as the pool page does, around the pool's price now", () => {
    const days = history((before) => [95 + (before % 3), 100 + (before % 5)]);
    const outlook = positionOutlook({ position: position(), history: days, parameters: PARAMETERS });
    const volatility = calculateHistoricalVolatility(takeRecentDays(days, 31)!);
    if (volatility.status === "unavailable") throw new Error("fixture has no volatility");
    const expected = projectLogSymmetricBand({
      price: priceAtTick({ tick: 46_000, token0Decimals: 18, token1Decimals: 18 })!,
      annualizedVolatility: volatility.data.annualizedVolatility,
      ...PARAMETERS,
    })!;

    expect(outlook?.suggested).toEqual({ lowerPrice: expected.lowerPrice, upperPrice: expected.upperPrice });
    expect(outlook!.suggested!.lowerPrice).toBeLessThan(outlook!.suggested!.upperPrice);
  });

  it("draws no suggested range when the pool's price now is not known, and still counts the days", () => {
    const outlook = positionOutlook({ position: position({ currentTick: null }), history: history(() => [95, 105]), parameters: PARAMETERS });

    expect(outlook).toMatchObject({ days: 30, inside: 30, suggested: null });
  });

  it("is nothing for another pool's history, or a history with no days", () => {
    expect(positionOutlook({ position: position(), history: history(() => [95, 105], `0x${"cd".repeat(20)}`), parameters: PARAMETERS })).toBeNull();
    expect(positionOutlook({ position: position(), history: { ...history(() => [95, 105]), points: [] }, parameters: PARAMETERS })).toBeNull();
  });

  it("matches the pool whatever the case of its id", () => {
    const upper = history(() => [95, 105], POOL_ID.toUpperCase().replace("0X", "0x"));

    expect(positionOutlook({ position: position(), history: upper, parameters: PARAMETERS })).not.toBeNull();
  });
});
