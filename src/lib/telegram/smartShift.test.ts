import { describe, expect, it } from "vitest";

import type { Position, V3PoolMetadata } from "../../schemas";
import type { SmartPair } from "../analytics/smartLiquidity";
import { hasShifted, MIN_SMART_POSITIONS, SMART_SHIFT_SHARE, smartShifts } from "./smartShift";

const poolAt = (index: number): V3PoolMetadata => ({
  protocolVersion: "v3",
  chainId: 1,
  id: `0x${index.toString(16).padStart(40, "0").toUpperCase().replace("0X", "0x")}`,
  feePpm: 500,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
});

const key = (index: number) => poolAt(index).id.toLowerCase();

const pair = (index: number, lower: number, upper: number, positions = MIN_SMART_POSITIONS): SmartPair => ({
  pool: poolAt(index),
  positions,
  valueUsd: 1,
  medianLowerRatio: 0.9,
  medianUpperRatio: 1.1,
  medianLowerPrice: lower,
  medianUpperPrice: upper,
  medianYearlyYield: 0.3,
  currentPrice: (lower + upper) / 2,
});

const held = (index: number, protocolVersion: "v3" | "v4" = "v3"): Position =>
  ({ tokenId: String(index), pool: { ...poolAt(index), protocolVersion } }) as unknown as Position;

const pairs = (...list: SmartPair[]) => new Map(list.map((entry) => [entry.pool.id.toLowerCase(), entry]));

describe("whether a range has shifted", () => {
  /* A range 100 to 200 is ln 2 wide: half of it is a factor of the square root of two. */
  it("is when an edge has moved by half the range's own width in log space, either edge, either way", () => {
    const factor = Math.exp(Math.log(2) * SMART_SHIFT_SHARE);

    expect(hasShifted([100, 200], [100 * factor * 1.001, 200])).toBe(true);
    expect(hasShifted([100, 200], [100, 200 * factor * 1.001])).toBe(true);
    expect(hasShifted([100, 200], [(100 / factor) * 0.999, 200])).toBe(true);
    expect(hasShifted([100, 200], [100 * factor * 0.999, 200])).toBe(false);
    expect(hasShifted([100, 200], [100, 200])).toBe(false);
  });

  it("is not for a range that has no width to measure against, or an edge that is not a price", () => {
    expect(hasShifted([100, 100], [200, 400])).toBe(false);
    expect(hasShifted([200, 100], [100, 200])).toBe(false);
    expect(hasShifted([100, 200], [0, 200])).toBe(false);
    expect(hasShifted([100, 200], [100, Number.NaN])).toBe(false);
  });
});

describe("the shifts to tell a chat that asked", () => {
  it("makes a baseline of a pool's first reading and says nothing", () => {
    const { shifts, ranges } = smartShifts({}, [held(1)], pairs(pair(1, 100, 200)));

    expect(shifts).toEqual([]);
    expect(ranges).toEqual({ [key(1)]: [100, 200] });
  });

  it("tells a shift once, and keeps the range it told as the new baseline", () => {
    const first = smartShifts({ [key(1)]: [100, 200] }, [held(1)], pairs(pair(1, 150, 300)));

    expect(first.shifts).toEqual([{ pair: pair(1, 150, 300), then: [100, 200], now: [150, 300] }]);
    expect(first.ranges).toEqual({ [key(1)]: [150, 300] });
    expect(smartShifts(first.ranges, [held(1)], pairs(pair(1, 150, 300))).shifts).toEqual([]);
  });

  it("keeps the baseline through drift that is not far enough, so a slow move is told when it has gone far", () => {
    let ranges = smartShifts({ [key(1)]: [100, 200] }, [held(1)], pairs(pair(1, 110, 220))).ranges;
    expect(ranges).toEqual({ [key(1)]: [100, 200] });

    const later = smartShifts(ranges, [held(1)], pairs(pair(1, 150, 300)));
    expect(later.shifts).toHaveLength(1);
    ranges = later.ranges;
    expect(ranges).toEqual({ [key(1)]: [150, 300] });
  });

  it("does not take a median of too few positions for a range, and keeps the baseline it had", () => {
    const thin = pairs(pair(1, 500, 900, MIN_SMART_POSITIONS - 1));

    expect(smartShifts({ [key(1)]: [100, 200] }, [held(1)], thin)).toEqual({ shifts: [], ranges: { [key(1)]: [100, 200] } });
    expect(smartShifts({}, [held(1)], thin)).toEqual({ shifts: [], ranges: {} });
  });

  it("keeps the baseline of a held pool nothing was measured for this time", () => {
    expect(smartShifts({ [key(1)]: [100, 200] }, [held(1)], pairs())).toEqual({ shifts: [], ranges: { [key(1)]: [100, 200] } });
  });

  it("drops the baseline of a pool no longer held, and asks only about pools of v3", () => {
    const { shifts, ranges } = smartShifts(
      { [key(1)]: [100, 200], [key(2)]: [100, 200], [key(3)]: [100, 200] },
      [held(1), held(3, "v4")],
      pairs(pair(1, 100, 200), pair(2, 500, 900), pair(3, 500, 900)),
    );

    expect(shifts).toEqual([]);
    expect(ranges).toEqual({ [key(1)]: [100, 200] });
  });

  it("finds a pool by its address however it is written, and tells each held pool once however many positions are in it", () => {
    const upper = { ...held(1), pool: { ...poolAt(1), id: poolAt(1).id.toUpperCase().replace("0X", "0x") } } as unknown as Position;
    const { shifts } = smartShifts({ [key(1)]: [100, 200] }, [held(1), upper], pairs(pair(1, 300, 600)));

    expect(shifts).toHaveLength(1);
  });
});
