import { describe, expect, it } from "vitest";

import type { V3PoolWithTick } from "../uniswap/ethereumV3PoolsByIds";
import type { RawV3Positions } from "../uniswap/ethereumV3Positions";
import { priceAtTick } from "../uniswap/v3TickMath";
import { composeAddressPositions, derivedPoolAddresses } from "./addressPositions";

/*
 * The live position this was built against, read on 2026-09-18: token #1112391,
 * XOR/WETH at the 1% tier, ticks -414400 to 0, in the pool the factory derives
 * to. The factory is the one the position manager reports for itself.
 */
const OWNER = "0xb6f1f0c31689f4c06df33c88da2a8b9c7c0fedbd";
const FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";
const XOR = "0x40fd72257597aa14c7231a7b1aaa29fce868f677";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const POOL = "0x7f63306a62c345365881e0fff85cb2c8baaa13d5";
const FETCHED_AT = "2026-09-18T07:00:00.000Z";

const position = (overrides: Record<string, unknown> = {}) => ({
  tokenId: "1112391",
  token0: XOR,
  token1: WETH,
  feePpm: 10_000,
  tickLower: -414_400,
  tickUpper: 0,
  liquidity: "38349616863029655014582929927279522",
  ...overrides,
});

const raw = (overrides: Partial<RawV3Positions> = {}): RawV3Positions =>
  ({
    factory: FACTORY,
    held: 1,
    read: 1,
    open: [position()],
    closed: 0,
    ...overrides,
  }) as RawV3Positions;

const pool = (overrides: Record<string, unknown> = {}, tick: number | null = -200_000): V3PoolWithTick =>
  ({
    pool: {
      protocolVersion: "v3",
      chainId: 1,
      id: POOL,
      feePpm: 10_000,
      token0: { chainId: 1, address: XOR, symbol: "XOR", decimals: 18 },
      token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
      ...overrides,
    },
    tick,
  }) as unknown as V3PoolWithTick;

const compose = (input: Partial<Parameters<typeof composeAddressPositions>[0]> = {}) =>
  composeAddressPositions({
    address: OWNER,
    raw: raw(),
    pools: [pool()],
    fetchedAt: FETCHED_AT,
    ...input,
  });

const succeed = (input: Partial<Parameters<typeof composeAddressPositions>[0]> = {}) => {
  const result = compose(input);
  if (result.status === "unavailable") throw new Error(`expected positions: ${result.notice}`);
  return result.data;
};

describe("derivedPoolAddresses", () => {
  it("derives the pool the indexer publishes for a live position", () => {
    expect(derivedPoolAddresses(raw())).toEqual([POOL]);
  });

  it("asks about each pool once, however many positions share it", () => {
    expect(derivedPoolAddresses(raw({ open: [position(), position({ tokenId: "2" })] }))).toEqual([
      POOL,
    ]);
  });
});

describe("composeAddressPositions", () => {
  it("prices a position from the ticks the manager recorded", () => {
    const [first] = succeed().positions;

    expect(first?.tokenId).toBe("1112391");
    expect(first?.lowerPrice).toBeCloseTo(
      priceAtTick({ tick: -414_400, token0Decimals: 18, token1Decimals: 18 }) ?? 0,
      18,
    );
    expect(first?.upperPrice).toBeCloseTo(1, 12);
  });

  /*
   * Uniswap's own rule, and the figure a holder reads first: earning while the
   * pool's tick is at or above the lower bound and strictly below the upper.
   */
  it.each([
    ["inside", -200_000, true],
    ["on the lower bound", -414_400, true],
    ["on the upper bound", 0, false],
    ["below", -500_000, false],
    ["above", 10, false],
  ])("says a pool at a tick %s is or is not earning", (_label, tick, expected) => {
    expect(succeed({ pools: [pool({}, tick)] }).positions[0]?.inRange).toBe(expected);
  });

  it("says it does not know when the pool reports no tick", () => {
    const [first] = succeed({ pools: [pool({}, null)] }).positions;

    expect(first?.inRange).toBeNull();
    expect(first?.currentTick).toBeNull();
  });

  /*
   * The check that makes deriving an address safe at all. A pool that comes back
   * describing a different pair or a different fee is not this position's pool,
   * whatever the arithmetic produced.
   */
  it.each([
    ["the source knows nothing about the derived address", { pools: [] }],
    ["the pool reports a different fee", { pools: [pool({ feePpm: 3_000 })] }],
    [
      "the pool reports a different pair",
      { pools: [pool({ token0: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 } })] },
    ],
  ])("drops a position when %s", (_label, input) => {
    const answer = succeed(input);

    expect(answer.positions).toEqual([]);
    /* Dropped from the list and still counted: the reader holds it either way. */
    expect(answer.open).toBe(1);
  });

  it("counts everything that was read, and lists only what fits", () => {
    const many = Array.from({ length: 15 }, (_unused, index) =>
      position({ tokenId: String(index + 1) }),
    );
    const answer = succeed({ raw: raw({ held: 20, read: 20, open: many, closed: 5 }) });

    expect(answer.held).toBe(20);
    expect(answer.open).toBe(15);
    expect(answer.closed).toBe(5);
    expect(answer.positions).toHaveLength(12);
  });

  it("answers for an address holding nothing", () => {
    const answer = succeed({ raw: raw({ held: 0, read: 0, open: [], closed: 0 }) });

    expect(answer.positions).toEqual([]);
    expect(answer.held).toBe(0);
  });

  it("carries the moment it was read and both sources", () => {
    const answer = succeed();

    expect(answer.fetchedAt).toBe(FETCHED_AT);
    expect(answer.sources).toEqual(["uniswap-v3-subgraph", "ethereum-rpc"]);
  });

  it("publishes nothing when the counts contradict each other", () => {
    expect(compose({ raw: raw({ held: 0, read: 1 }) })).toEqual({
      status: "unavailable",
      notice: "positions-unverifiable",
    });
  });
});
