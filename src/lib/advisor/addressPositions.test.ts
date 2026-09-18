import { describe, expect, it } from "vitest";

import type { V3PoolWithTick } from "../uniswap/ethereumV3PoolsByIds";
import type { RawV3Positions } from "../uniswap/ethereumV3Positions";
import type { V4PoolTokens } from "../uniswap/ethereumV4PoolsByIds";
import type { RawV4Positions } from "../uniswap/ethereumV4Positions";
import { priceAtTick } from "../uniswap/v3TickMath";
import { DYNAMIC_FEE_FLAG } from "../uniswap/v4PoolKey";
import {
  composeAddressPositions,
  derivedPoolAddresses,
  heldPoolIds,
} from "./addressPositions";

/*
 * The two live positions this was built against, both read on 2026-09-18.
 *
 * v3: token #1112391, XOR/WETH at the 1% tier, ticks -414400 to 0, in the pool
 * the factory derives to. v4: token #408162, full-range in the ETH/HEI pool at a
 * 70% fee and a spacing of 7000 — native ether as currency0, and a pool id that
 * is the keccak of the key beside it.
 */
const OWNER = "0xb6f1f0c31689f4c06df33c88da2a8b9c7c0fedbd";
const FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";
const XOR = "0x40fd72257597aa14c7231a7b1aaa29fce868f677";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const POOL = "0x7f63306a62c345365881e0fff85cb2c8baaa13d5";
const NATIVE = "0x0000000000000000000000000000000000000000";
const HEI = "0xf8f173e20e15f3b6cb686fb64724d370689de083";
const V4_POOL = "0xa86fb6fbddb6d2e85e39b9894ff33c799cddbc4051ede12bc8399b8c3d51670a";
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

const rawV3 = (overrides: Partial<RawV3Positions> = {}): RawV3Positions =>
  ({
    factory: FACTORY,
    held: 1,
    read: 1,
    open: [position()],
    closed: 0,
    ...overrides,
  }) as RawV3Positions;

const pool = (
  overrides: Record<string, unknown> = {},
  tick: number | null = -200_000,
): V3PoolWithTick =>
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

const v4Position = (overrides: Record<string, unknown> = {}) => ({
  tokenId: "408162",
  key: {
    currency0: NATIVE,
    currency1: HEI,
    fee: 700_000,
    tickSpacing: 7_000,
    hooks: NATIVE,
  },
  poolId: V4_POOL,
  tickLower: -882_000,
  tickUpper: 882_000,
  liquidity: "28519709909040362220",
  ...overrides,
});

const rawV4 = (overrides: Partial<RawV4Positions> = {}): RawV4Positions =>
  ({
    held: 1,
    read: 1,
    open: [v4Position()],
    closed: 0,
    ...overrides,
  }) as RawV4Positions;

const v4Pool = (overrides: Partial<V4PoolTokens> = {}): V4PoolTokens => ({
  poolId: V4_POOL,
  token0: { chainId: 1, address: NATIVE, symbol: "ETH", decimals: 18 },
  token1: { chainId: 1, address: HEI, symbol: "HEI", decimals: 18 },
  tick: 98_526,
  ...overrides,
});

type Input = Parameters<typeof composeAddressPositions>[0];

const compose = (input: Partial<Input> = {}) =>
  composeAddressPositions({
    address: OWNER,
    v3: { raw: rawV3(), pools: [pool()] },
    v4: null,
    fetchedAt: FETCHED_AT,
    ...input,
  });

const succeed = (input: Partial<Input> = {}) => {
  const result = compose(input);
  if (result.status === "unavailable") throw new Error(`expected positions: ${result.notice}`);
  return result.data;
};

describe("the pools a read has to look up", () => {
  it("derives the v3 pool the indexer publishes for a live position", () => {
    expect(derivedPoolAddresses(rawV3())).toEqual([POOL]);
  });

  it("asks about each v3 pool once, however many positions share it", () => {
    expect(derivedPoolAddresses(rawV3({ open: [position(), position({ tokenId: "2" })] }))).toEqual([
      POOL,
    ]);
  });

  it("takes the v4 pool ids the manager already proved, once each", () => {
    expect(heldPoolIds(rawV4({ open: [v4Position(), v4Position({ tokenId: "2" })] }))).toEqual([
      V4_POOL,
    ]);
  });
});

describe("composing a v3 position", () => {
  it("prices it from the ticks the manager recorded", () => {
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
    expect(
      succeed({ v3: { raw: rawV3(), pools: [pool({}, tick)] } }).positions[0]?.inRange,
    ).toBe(expected);
  });

  it("says it does not know when the pool reports no tick", () => {
    const [first] = succeed({ v3: { raw: rawV3(), pools: [pool({}, null)] } }).positions;

    expect(first?.inRange).toBeNull();
    expect(first?.currentTick).toBeNull();
  });

  /*
   * The check that makes deriving an address safe at all. A pool that comes back
   * describing a different pair or a different fee is not this position's pool,
   * whatever the arithmetic produced.
   */
  it.each([
    ["the source knows nothing about the derived address", []],
    ["the pool reports a different fee", [pool({ feePpm: 3_000 })]],
    [
      "the pool reports a different pair",
      [pool({ token0: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 } })],
    ],
  ])("drops a position when %s", (_label, pools) => {
    const answer = succeed({ v3: { raw: rawV3(), pools } });

    expect(answer.positions).toEqual([]);
    /* Dropped from the list and still counted: the reader holds it either way. */
    expect(answer.open).toBe(1);
  });
});

describe("composing a v4 position", () => {
  const onlyV4 = (input: Partial<Input> = {}) =>
    succeed({ v3: null, v4: { raw: rawV4(), pools: [v4Pool()] }, ...input });

  it("builds the pool out of the key the manager proved", () => {
    const [first] = onlyV4().positions;

    expect(first?.tokenId).toBe("408162");
    expect(first?.pool).toEqual({
      protocolVersion: "v4",
      chainId: 1,
      id: V4_POOL,
      token0: { chainId: 1, address: NATIVE, symbol: "ETH", decimals: 18 },
      token1: { chainId: 1, address: HEI, symbol: "HEI", decimals: 18 },
      tickSpacing: 7_000,
      fee: { kind: "static", feePpm: 700_000 },
      protocolFee: null,
      hookAddress: null,
    });
    /* The pool's tick sits inside a full-range position, so it is earning. */
    expect(first?.inRange).toBe(true);
    expect(first?.currentTick).toBe(98_526);
  });

  /*
   * The key is the only source that says which kind of fee a pool charges, and a
   * dynamic one has no fee to report — the hook sets it at the moment of a swap,
   * and this read never asked the pool's state.
   */
  it("reports a dynamic fee as unobserved rather than as a number", () => {
    const hooked = "0x000000000000000000000000000000000000f0c0";
    const answer = onlyV4({
      v4: {
        raw: rawV4({
          open: [
            v4Position({
              key: {
                currency0: NATIVE,
                currency1: HEI,
                fee: DYNAMIC_FEE_FLAG,
                tickSpacing: 7_000,
                hooks: hooked,
              },
            }),
          ],
        }),
        pools: [v4Pool()],
      },
    });

    expect(answer.positions[0]?.pool).toMatchObject({
      fee: { kind: "dynamic", currentFeePpm: null },
      hookAddress: hooked,
    });
  });

  it.each([
    ["the source knows nothing about the proved id", [v4Pool({ poolId: `0x${"1".repeat(64)}` })]],
    [
      "the source names a currency1 the key does not",
      [v4Pool({ token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 } })],
    ],
    /*
     * The key's currency0 here is the zero address, which is how v4 spells the
     * chain's own ether. A source naming wrapped ether instead still sorts
     * correctly against currency1, so nothing but this check would catch it.
     */
    [
      "the source names wrapped ether where the key says native",
      [v4Pool({ token0: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 } })],
    ],
  ])("drops a v4 position when %s", (_label, pools) => {
    const answer = succeed({ v3: null, v4: { raw: rawV4(), pools } });

    expect(answer.positions).toEqual([]);
    expect(answer.open).toBe(1);
  });
});

describe("composing both protocols at once", () => {
  const both = { v3: { raw: rawV3(), pools: [pool()] }, v4: { raw: rawV4(), pools: [v4Pool()] } };

  it("lists them together and adds up what each read found", () => {
    const answer = succeed(both);

    expect(answer.positions.map((held) => held.pool.protocolVersion)).toEqual(["v3", "v4"]);
    expect(answer.held).toBe(2);
    expect(answer.read).toBe(2);
    expect(answer.open).toBe(2);
    expect(answer.unread).toEqual([]);
    expect(answer.sources).toEqual([
      "uniswap-v3-subgraph",
      "uniswap-v4-subgraph",
      "ethereum-rpc",
    ]);
  });

  /*
   * Two protocols mean two ways to fail, and one failing must not take the other
   * with it — nor be passed over in silence, because the counts then describe
   * one protocol while the heading promises both.
   */
  it.each([
    ["v4", { v3: both.v3, v4: null }, "v4", ["uniswap-v3-subgraph", "ethereum-rpc"]],
    ["v3", { v3: null, v4: both.v4 }, "v3", ["uniswap-v4-subgraph", "ethereum-rpc"]],
  ])("names %s when only that protocol could not be read", (_label, input, named, sources) => {
    const answer = succeed(input);

    expect(answer.unread).toEqual([named]);
    expect(answer.held).toBe(1);
    expect(answer.sources).toEqual(sources);
  });

  it("publishes nothing when neither protocol could be read", () => {
    expect(compose({ v3: null, v4: null })).toEqual({
      status: "unavailable",
      notice: "positions-unverifiable",
    });
  });

  it("counts everything that was read, and lists only what fits", () => {
    const many = Array.from({ length: 15 }, (_unused, index) =>
      position({ tokenId: String(index + 1) }),
    );
    const answer = succeed({
      v3: { raw: rawV3({ held: 20, read: 20, open: many, closed: 5 }), pools: [pool()] },
    });

    expect(answer.held).toBe(20);
    expect(answer.open).toBe(15);
    expect(answer.closed).toBe(5);
    expect(answer.positions).toHaveLength(12);
  });

  it("answers for an address holding nothing of either protocol", () => {
    const answer = succeed({
      v3: { raw: rawV3({ held: 0, read: 0, open: [], closed: 0 }), pools: [] },
      v4: { raw: rawV4({ held: 0, read: 0, open: [], closed: 0 }), pools: [] },
    });

    expect(answer.positions).toEqual([]);
    expect(answer.held).toBe(0);
    expect(answer.unread).toEqual([]);
  });

  it("carries the moment it was read", () => {
    expect(succeed().fetchedAt).toBe(FETCHED_AT);
  });

  it("publishes nothing when the counts contradict each other", () => {
    expect(compose({ v3: { raw: rawV3({ held: 0, read: 1 }), pools: [pool()] } })).toEqual({
      status: "unavailable",
      notice: "positions-unverifiable",
    });
  });
});
