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
  describeOneV3,
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
  /* The manager's fee accounting, untouched since this position was opened. */
  feeGrowthInside0Last: 0n,
  feeGrowthInside1Last: 0n,
  tokensOwed0: 0n,
  tokensOwed1: 0n,
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

/** Most cases are about the list rather than the earnings, so they pass none. */
const noFees = new Map<string, { token0: string; token1: string }>();

type Input = Parameters<typeof composeAddressPositions>[0];

const compose = (input: Partial<Input> = {}) =>
  composeAddressPositions({
    address: OWNER,
    v3: { raw: rawV3(), pools: [pool()], fees: noFees },
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
      succeed({ v3: { raw: rawV3(), pools: [pool({}, tick)], fees: noFees } }).positions[0]?.inRange,
    ).toBe(expected);
  });

  it("says it does not know when the pool reports no tick", () => {
    const [first] = succeed({ v3: { raw: rawV3(), pools: [pool({}, null)], fees: noFees } }).positions;

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
    const answer = succeed({ v3: { raw: rawV3(), pools, fees: noFees } });

    expect(answer.positions).toEqual([]);
    /* Dropped from the list and still counted: the reader holds it either way. */
    expect(answer.open).toBe(1);
  });
});

describe("composing a v4 position", () => {
  const onlyV4 = (input: Partial<Input> = {}) =>
    succeed({ v3: null, v4: { raw: rawV4(), pools: [v4Pool()], fees: noFees }, ...input });

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
  it("carries the protocol's cut read with the fees, and leaves it unread where that read did not answer", () => {
    const cut = { zeroForOnePpm: 100, oneForZeroPpm: 125 };
    const read = onlyV4({ v4: { raw: rawV4(), pools: [v4Pool()], fees: noFees, protocolFees: new Map([[V4_POOL, cut]]) } });
    const unread = onlyV4({ v4: { raw: rawV4(), pools: [v4Pool()], fees: noFees, protocolFees: new Map() } });

    expect(read.positions[0]?.pool).toMatchObject({ protocolFee: cut });
    expect(unread.positions[0]?.pool).toMatchObject({ protocolFee: null });
  });

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
        fees: noFees,
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
    const answer = succeed({ v3: null, v4: { raw: rawV4(), pools, fees: noFees } });

    expect(answer.positions).toEqual([]);
    expect(answer.open).toBe(1);
  });
});

describe("composing both protocols at once", () => {
  const both = { v3: { raw: rawV3(), pools: [pool()], fees: noFees }, v4: { raw: rawV4(), pools: [v4Pool()], fees: noFees } };

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
      v3: { raw: rawV3({ held: 20, read: 20, open: many, closed: 5 }), pools: [pool()], fees: noFees },
    });

    expect(answer.held).toBe(20);
    expect(answer.open).toBe(15);
    expect(answer.closed).toBe(5);
    expect(answer.positions).toHaveLength(12);
  });

  it("answers for an address holding nothing of either protocol", () => {
    const answer = succeed({
      v3: { raw: rawV3({ held: 0, read: 0, open: [], closed: 0 }), pools: [], fees: noFees },
      v4: { raw: rawV4({ held: 0, read: 0, open: [], closed: 0 }), pools: [], fees: noFees },
    });

    expect(answer.positions).toEqual([]);
    expect(answer.held).toBe(0);
    expect(answer.unread).toEqual([]);
  });

  it("carries the moment it was read", () => {
    expect(succeed().fetchedAt).toBe(FETCHED_AT);
  });

  /*
   * The fee read is an addition to this answer, not a part of it. A position
   * missing from the map is shown without the figure — never with a zero,
   * which would say it has earned nothing.
   */
  it("attaches what each position earned, on either protocol", () => {
    const answer = succeed({
      v3: {
        raw: rawV3(),
        pools: [pool()],
        fees: new Map([["1112391", { token0: "161442767", token1: "64800531737822263" }]]),
      },
      v4: {
        raw: rawV4(),
        pools: [v4Pool()],
        fees: new Map([["408162", { token0: "0", token1: "0" }]]),
      },
    });

    expect(answer.positions[0]?.uncollected).toEqual({
      token0: "161442767",
      token1: "64800531737822263",
    });
    expect(answer.positions[1]?.uncollected).toEqual({ token0: "0", token1: "0" });
  });

  it("leaves the figure out rather than calling it zero when it was not read", () => {
    expect(succeed().positions[0]?.uncollected).toBeNull();
  });

  it("still lists a position whose fees came back for somebody else", () => {
    const answer = succeed({
      v3: {
        raw: rawV3(),
        pools: [pool()],
        fees: new Map([["999", { token0: "5", token1: "5" }]]),
      },
    });

    expect(answer.positions).toHaveLength(1);
    expect(answer.positions[0]?.uncollected).toBeNull();
  });

  it("publishes nothing when the counts contradict each other", () => {
    expect(compose({ v3: { raw: rawV3({ held: 0, read: 1 }), pools: [pool()], fees: noFees } })).toEqual({
      status: "unavailable",
      notice: "positions-unverifiable",
    });
  });
});

describe("positions off mainnet", () => {
  it("does not call v4 unread where it was never asked", () => {
    expect(succeed({ v4: null, v4Asked: false }).unread).toEqual([]);
  });

  it("still calls it unread on mainnet, where it was asked and did not answer", () => {
    expect(succeed({ v4: null }).unread).toEqual(["v4"]);
  });
});

describe("positions on a v4-only chain", () => {
  const v4Only = { v3: null, v4: { raw: rawV4(), pools: [v4Pool()], fees: noFees } };

  it("does not call v3 unread where it was never asked", () => {
    expect(succeed({ ...v4Only, v3Asked: false }).unread).toEqual([]);
  });

  it("still calls it unread where it was asked and did not answer", () => {
    expect(succeed(v4Only).unread).toEqual(["v3"]);
  });
});

/*
 * The record under each listed v3 position, built beside the answer from the
 * same reads. Only its wiring is checked here — which position gets which
 * history, fees and price — and positionRecord.test.ts checks the arithmetic.
 */
describe("each listed v3 position's record", () => {
  const LIQUIDITY = BigInt(position().liquidity);
  /* Opened once, never touched: the subgraph's only row is the manager's record now. */
  const opened = {
    blockNumber: 18_000_000n,
    at: "2023-08-01T00:00:00.000Z",
    liquidity: LIQUIDITY,
    deposited0: 1_000_000,
    deposited1: 0,
    withdrawn0: 0,
    withdrawn1: 0,
    feeGrowthInside0: 0n,
    feeGrowthInside1: 0n,
  };
  const histories = (snapshots = [opened]) =>
    ({
      status: "success",
      data: { asked: new Set(["1112391"]), snapshots: new Map([["1112391", snapshots]]), unreadable: new Set<string>() },
    }) as const;
  const fees = new Map([["1112391", { token0: "5", token1: "6" }]]);
  /* Tick -200,000, inside the range. */
  const sqrtPrices = new Map([["1112391", BigInt(Math.round(1.0001 ** -100_000 * 2 ** 96))]]);
  const v3 = (overrides: Record<string, unknown> = {}) => ({
    raw: rawV3(),
    pools: [pool()],
    fees,
    sqrtPrices,
    history: histories(),
    ...overrides,
  });

  const records = (input: Partial<Input>) => {
    const result = compose(input);
    if (result.status === "unavailable") throw new Error(`expected positions: ${result.notice}`);
    return result.records;
  };

  it("is built from the history, the fees and the price read for that position", () => {
    const record = records({ v3: v3() })?.get("1112391");

    expect(record?.status).toBe("verified");
    if (record?.status !== "verified") return;
    expect(record.record.deposited).toEqual({ token0: 1_000_000, token1: 0 });
    /* Nothing between changes, so its fees are the chain's since the last one, in XOR's and WETH's eighteen decimals. */
    expect(record.record.fees).toEqual({ token0: 5e-18, token1: 6e-18 });
    expect(record.record.price).toBeCloseTo(1.0001 ** -200_000, 12);
  });

  it("is left off the answer entirely when no history was asked for", () => {
    const result = compose({ v3: { raw: rawV3(), pools: [pool()], fees } });

    expect(result.status === "success" && "records" in result).toBe(false);
  });

  it("is unread when the history read failed, and the list is the same", () => {
    const failed = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } as const;

    expect(records({ v3: v3({ history: failed }) })?.get("1112391")).toEqual({ status: "unread" });
    expect(succeed({ v3: v3({ history: failed }) }).positions).toEqual(succeed({ v3: v3() }).positions);
  });

  it("is unread when the price was not read with the fees", () => {
    expect(records({ v3: v3({ sqrtPrices: new Map() }) })?.get("1112391")).toEqual({ status: "unread" });
  });

  it("is unverified when the history is not the manager's record now", () => {
    expect(records({ v3: v3({ history: histories([{ ...opened, liquidity: LIQUIDITY - 1n }]) }) })?.get("1112391")).toEqual({
      status: "unverified",
      reason: "liquidity-differs",
    });
  });

  it("is only for a position that is listed", () => {
    expect(records({ v3: v3({ pools: [] }) })).toEqual(new Map());
  });

  /* Asked for and with no v3 to build from: there are none, and the page still knows they were asked for. */
  it("is an empty set, not a missing one, when histories were asked for on a chain with no v3 read", () => {
    expect(records({ v3: null, v4: { raw: rawV4(), pools: [v4Pool()], fees: noFees }, historyAsked: true })).toEqual(new Map());
  });

  it("is never made for a v4 position", () => {
    expect(records({ v3: v3(), v4: { raw: rawV4(), pools: [v4Pool()], fees: noFees } })?.has("408162")).toBe(false);
  });

  /*
   * The two managers number their tokens apart, so one address can hold v3
   * #408162 and v4 #408162 at once. The record under that id is the v3 one's,
   * and the v4 position is not given it — nor allowed to overwrite it.
   */
  it("is the v3 position's when a v4 position carries the same token id", () => {
    const shared = "408162";
    const keyed = <T,>(map: ReadonlyMap<string, T>) => new Map([...map.values()].map((value) => [shared, value]));
    const twin = {
      raw: rawV3({ open: [position({ tokenId: shared })] }),
      pools: [pool()],
      fees: keyed(fees),
      sqrtPrices: keyed(sqrtPrices),
      history: {
        status: "success",
        data: { asked: new Set([shared]), snapshots: new Map([[shared, [opened]]]), unreadable: new Set<string>() },
      } as const,
    };

    const built = records({ v3: twin, v4: { raw: rawV4(), pools: [v4Pool()], fees: noFees } });

    expect(built?.size).toBe(1);
    expect(built?.get(shared)?.status).toBe("verified");
  });
});

/*
 * One position with its record, for the card that shares it: the same proof
 * and the same record the list makes, from a side read for that one id.
 */
describe("one v3 position described on its own", () => {
  const LIQUIDITY = BigInt(position().liquidity);
  const opened = {
    blockNumber: 18_000_000n,
    at: "2023-08-01T00:00:00.000Z",
    liquidity: LIQUIDITY,
    deposited0: 1_000_000,
    deposited1: 0,
    withdrawn0: 0,
    withdrawn1: 0,
    feeGrowthInside0: 0n,
    feeGrowthInside1: 0n,
  };
  const side = (overrides: Record<string, unknown> = {}) => ({
    raw: rawV3(),
    pools: [pool()],
    fees: new Map([["1112391", { token0: "5", token1: "6" }]]),
    sqrtPrices: new Map([["1112391", BigInt(Math.round(1.0001 ** -100_000 * 2 ** 96))]]),
    history: {
      status: "success",
      data: { asked: new Set(["1112391"]), snapshots: new Map([["1112391", [opened]]]), unreadable: new Set<string>() },
    } as const,
    ...overrides,
  });

  it("is the position the list would show, with the record the list would put under it", () => {
    const described = describeOneV3(side(), "1112391");
    const listed = composeAddressPositions({ address: OWNER, v3: side(), v4: null, fetchedAt: FETCHED_AT });

    expect(described?.position).toEqual(listed.status === "success" ? listed.data.positions[0] : null);
    expect(described?.record).toEqual(listed.status === "success" ? listed.records?.get("1112391") : null);
    expect(described?.record.status).toBe("verified");
  });

  it("is nothing for an id the side does not hold, or a pool the source does not confirm", () => {
    expect(describeOneV3(side(), "7")).toBeNull();
    expect(describeOneV3(side({ pools: [] }), "1112391")).toBeNull();
    expect(describeOneV3(side({ pools: [pool({ feePpm: 3_000 })] }), "1112391")).toBeNull();
  });

  it("carries the record's own verdict when the history does not reach the present, or was not read", () => {
    expect(describeOneV3(side({ history: { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } }), "1112391")?.record).toEqual({
      status: "unread",
    });
    expect(
      describeOneV3(
        side({
          history: {
            status: "success",
            data: { asked: new Set(["1112391"]), snapshots: new Map([["1112391", [{ ...opened, liquidity: LIQUIDITY - 1n }]]]), unreadable: new Set() },
          },
        }),
        "1112391",
      )?.record,
    ).toEqual({ status: "unverified", reason: "liquidity-differs" });
  });
});
