import { describe, expect, it } from "vitest";

import type { PoolSearchMatch, Position, V3PoolMetadata, V4Pool, V4PoolSearchMatch } from "../../schemas";
import { PAIR_RANKING_FLOOR_USD, type PoolWeeks } from "../advisor/pairPools";
import { chainById, ETHEREUM } from "../chains/chains";
import { priceAtTick } from "../uniswap/v3TickMath";
import { missedFeeYield, recentreCost } from "./leftRange";

/*
 * The two lines a left-range alert adds, checked against arithmetic written
 * out again here rather than called: the protocol's position formulas for what
 * a liquidity holds past an edge, and the one swap that leaves equal value of
 * each token after the pool's fee.
 *
 * The position is mainnet #998651's shape — USDC/WETH at 0.05%, ticks 190190
 * to 200570, the liquidity the chain held for it — moved out of its range on
 * one side or the other. The pools in the searches are invented.
 */

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const V3_POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const V4_POOL = `0x${"ab".repeat(32)}`;
/** A hook whose address carries `beforeSwap` (bit 7): one that may change what a swap costs. */
const SWAP_HOOK = `0x${"1".repeat(36)}0080`;
/** A hook whose address carries only `afterInitialize` (bit 12): one that cannot. */
const QUIET_HOOK = `0x${"1".repeat(36)}1000`;

const TICK_LOWER = 190_190;
const TICK_UPPER = 200_570;
const LIQUIDITY = 2_204_989_653_163_776;

const token = (address: string, symbol: string, decimals: number, chainId = 1) => ({ chainId, address, symbol, decimals });

const v3Pool: V3PoolMetadata = {
  protocolVersion: "v3",
  chainId: 1,
  id: V3_POOL,
  token0: token(USDC, "USDC", 6),
  token1: token(WETH, "WETH", 18),
  feePpm: 500,
};

const v4Pool = (overrides: Partial<V4Pool> = {}): V4Pool => ({
  protocolVersion: "v4",
  chainId: 1,
  id: V4_POOL,
  token0: token(USDC, "USDC", 6),
  token1: token(WETH, "WETH", 18),
  tickSpacing: 10,
  fee: { kind: "static", feePpm: 500 },
  /* Different each way, so a swap charged the other direction's rate shows. */
  protocolFee: { zeroForOnePpm: 100, oneForZeroPpm: 125 },
  hookAddress: null,
  ...overrides,
});

const price = (tick: number) => priceAtTick({ tick, token0Decimals: 6, token1Decimals: 18 }) as number;

const at = (tick: number | null, overrides: Partial<Position> = {}): Position => {
  const tickLower = overrides.tickLower ?? TICK_LOWER;
  const tickUpper = overrides.tickUpper ?? TICK_UPPER;
  return {
    tokenId: "998651",
    pool: v3Pool,
    tickLower,
    tickUpper,
    lowerPrice: price(tickLower),
    upperPrice: price(tickUpper),
    liquidity: String(LIQUIDITY),
    uncollected: null,
    currentTick: tick,
    inRange: tick === null ? null : tick >= tickLower && tick < tickUpper,
    ...overrides,
  };
};

/** Below the range the position is USDC alone: `L · (1/√pa − 1/√pb)`, in whole USDC. */
const usdcHeld = (lower = TICK_LOWER, upper = TICK_UPPER) =>
  (LIQUIDITY * (1.0001 ** (-lower / 2) - 1.0001 ** (-upper / 2))) / 1e6;
/** Above it, WETH alone: `L · (√pb − √pa)`, in whole WETH. */
const wethHeld = (lower = TICK_LOWER, upper = TICK_UPPER) => (LIQUIDITY * (1.0001 ** (upper / 2) - 1.0001 ** (lower / 2))) / 1e18;

/** Equal value of each token after the fee `f`: `x / (2 − f)` of the one held is sold. */
const sold = (held: number, feePpm: number) => held / (2 - feePpm / 1e6);

const near = (value: number | undefined, expected: number) => expect((value ?? Number.NaN) / expected).toBeCloseTo(1, 9);

describe("what re-centring a position that left its range would swap", () => {
  it("sells USDC below the range: the share that leaves equal value of each after the fee, and the tier on it", () => {
    const cost = recentreCost(at(180_000));

    expect(cost?.sold).toBe("token0");
    expect(cost?.feePpm).toBe(500);
    near(cost?.amountIn, sold(usdcHeld(), 500));
    near(cost?.fee, 0.0005 * sold(usdcHeld(), 500));
    expect(cost?.hookMayAlterSwaps).toBe(false);
  });

  it("sells WETH above it, and the fee is in WETH", () => {
    const cost = recentreCost(at(210_000));

    expect(cost?.sold).toBe("token1");
    near(cost?.amountIn, sold(wethHeld(), 500));
    near(cost?.fee, 0.0005 * sold(wethHeld(), 500));
  });

  it("counts the upper tick itself as above: out of range, and all WETH", () => {
    const cost = recentreCost(at(TICK_UPPER));

    expect(cost?.sold).toBe("token1");
    near(cost?.amountIn, sold(wethHeld(), 500));
  });

  it("holds the same amount wherever on one side the price sits", () => {
    near(recentreCost(at(150_000))?.amountIn, recentreCost(at(TICK_LOWER - 1))?.amountIn ?? 0);
  });

  it("keeps the width as multiples of the centre, and centres the range on the price", () => {
    const position = at(180_000);
    const cost = recentreCost(position);

    near((cost?.upperPrice ?? 0) / (cost?.lowerPrice ?? 1), position.upperPrice / position.lowerPrice);
    near(Math.sqrt((cost?.lowerPrice ?? 0) * (cost?.upperPrice ?? 0)), price(180_000));
  });

  /*
   * Equal value of each token at the price whatever the width, so the share
   * sold does not move with it: a narrower range sells the same share of what
   * it holds, and sits somewhere narrower.
   */
  it("sells the same share of the holding at any width; the width moves only the range", () => {
    const narrow = at(180_000, { tickLower: 195_000, tickUpper: 196_000 });
    const narrowCost = recentreCost(narrow);
    const wideCost = recentreCost(at(180_000));

    near((narrowCost?.amountIn ?? 0) / usdcHeld(195_000, 196_000), (wideCost?.amountIn ?? 0) / usdcHeld());
    near((narrowCost?.upperPrice ?? 0) / (narrowCost?.lowerPrice ?? 1), 1.0001 ** 1_000);
  });

  it("charges a v4 swap its key's fee with the protocol's cut, in the swap's own direction", () => {
    const below = recentreCost(at(180_000, { pool: v4Pool() }));
    const above = recentreCost(at(210_000, { pool: v4Pool() }));

    /* 500 to providers and 100 or 125 to the protocol, combined as `ProtocolFeeLibrary` combines them. */
    expect(below?.feePpm).toBe(600);
    near(below?.amountIn, sold(usdcHeld(), 600));
    near(below?.fee, 0.0006 * sold(usdcHeld(), 600));
    expect(above?.feePpm).toBe(625);
    near(above?.amountIn, sold(wethHeld(), 625));
    near(above?.fee, 0.000625 * sold(wethHeld(), 625));
  });

  it("says where a hook may change what a swap costs, and still states the pool's own rate", () => {
    const hooked = recentreCost(at(180_000, { pool: v4Pool({ hookAddress: SWAP_HOOK }) }));

    expect(hooked?.hookMayAlterSwaps).toBe(true);
    expect(hooked?.feePpm).toBe(600);
    expect(recentreCost(at(180_000, { pool: v4Pool({ hookAddress: QUIET_HOOK }) }))?.hookMayAlterSwaps).toBe(false);
  });

  it.each([
    ["the position is inside its range", at(195_000)],
    ["the pool's tick was not read", at(null)],
    ["a hook sets the fee swap by swap", at(180_000, { pool: v4Pool({ fee: { kind: "dynamic", currentFeePpm: 3000 }, hookAddress: SWAP_HOOK }) })],
    ["the pool's key was not read", at(180_000, { pool: v4Pool({ fee: { kind: "unread" } }) })],
    ["the protocol's cut was not read", at(180_000, { pool: v4Pool({ protocolFee: null }) })],
    ["the ticks are outside the protocol's range", at(-900_000, { tickLower: -900_000 + 1, tickUpper: 0, lowerPrice: 1e-30, upperPrice: 1e-12 })],
  ])("is nothing when %s", (_label, position) => {
    expect(recentreCost(position)).toBeNull();
  });
});

/* ------------------------------------------------------------------ yield */

/** A v3 match holding `usdc` USDC and `weth` WETH, at 1 USDC = 1/4000 ETH. */
const v3Match = (usdc: number, weth: number, pool: V3PoolMetadata = v3Pool): PoolSearchMatch => ({
  pool,
  reserves: { token0: String(BigInt(Math.round(usdc * 1e6))), token1: String(BigInt(Math.round(weth * 1e6)) * 10n ** 12n) },
  ethPrice: { token0: 1 / 4000, token1: 1 },
  exactSymbolMatches: 2,
});

/**
 * A v4 match whose depth at the current price is `ether` worth of each side:
 * at a square-root price of one, `L` units of each token, both eighteen
 * decimals here, at one ether each.
 */
const v4Match = (ether: number, pool: V4Pool = v4Pool()): V4PoolSearchMatch => ({
  pool: { ...pool, token0: token(USDC, "USDC", 18), token1: token(WETH, "WETH", 18) },
  state: { liquidity: (BigInt(Math.round(ether * 1e6)) * 10n ** 12n).toString(), sqrtPriceX96: (1n << 96n).toString() },
  ethPrice: { token0: 1, token1: 1 },
  exactSymbolMatches: 2,
});

/** Seven whole days, so a week's fees annualise by 365 / 7. */
const weeks = (fees: Record<string, number>): PoolWeeks => ({
  byPool: new Map(Object.entries(fees).map(([id, feesUsd]) => [id, { volumeUsd: feesUsd * 2000, feesUsd, daysCounted: 7 }])),
  windowDays: 7,
});

const v4Position = (pool: V4Pool = v4Pool()) => at(180_000, { pool });

describe("what the range is missing: the pair page's fee yield for the position's pool", () => {
  it("is the week's fees over what the v3 pool's contracts hold, scaled to a year", () => {
    /* $50,000 of USDC and 12.5 WETH at $4,000: exactly the floor. */
    const figure = missedFeeYield({
      position: at(180_000),
      chain: ETHEREUM,
      found: { protocol: "v3", matches: [v3Match(50_000, 12.5)] },
      nativeUsd: 4_000,
      weeks: weeks({ [V3_POOL]: 500 }),
    });

    near(figure ?? undefined, (500 / 100_000) * (365 / 7));
  });

  it("gives nothing below the pair page's floor, and a figure at it", () => {
    const yieldAt = (usd: number) =>
      missedFeeYield({
        position: at(180_000),
        chain: ETHEREUM,
        found: { protocol: "v3", matches: [v3Match(usd / 2, usd / 2 / 4_000)] },
        nativeUsd: 4_000,
        weeks: weeks({ [V3_POOL]: 500 }),
      });

    expect(PAIR_RANKING_FLOOR_USD).toBe(100_000);
    expect(yieldAt(99_999)).toBeNull();
    expect(yieldAt(100_000)).not.toBeNull();
  });

  it("sets a v4 pool against its depth at the current price, not anything it is said to hold", () => {
    /* Twelve and a half ether of depth each side, at $4,000: $100,000. */
    const figure = missedFeeYield({
      position: v4Position(),
      chain: ETHEREUM,
      found: { protocol: "v4", matches: [v4Match(12.5)] },
      nativeUsd: 4_000,
      weeks: weeks({ [V4_POOL]: 700 }),
    });

    near(figure ?? undefined, (700 / 100_000) * (365 / 7));
    expect(
      missedFeeYield({
        position: v4Position(),
        chain: ETHEREUM,
        found: { protocol: "v4", matches: [{ ...v4Match(12.5), state: null }] },
        nativeUsd: 4_000,
        weeks: weeks({ [V4_POOL]: 700 }),
      }),
    ).toBeNull();
  });

  it("gives nothing where a hook may take part of a swap for itself, and a figure where it cannot", () => {
    const withHook = (hookAddress: string) =>
      missedFeeYield({
        position: v4Position(v4Pool({ hookAddress })),
        chain: ETHEREUM,
        found: { protocol: "v4", matches: [v4Match(25, v4Pool({ hookAddress }))] },
        nativeUsd: 4_000,
        weeks: weeks({ [V4_POOL]: 700 }),
      });

    expect(withHook(SWAP_HOOK)).toBeNull();
    expect(withHook(QUIET_HOOK)).not.toBeNull();
  });

  const read = {
    position: at(180_000),
    chain: ETHEREUM,
    found: { protocol: "v3", matches: [v3Match(500_000, 125)] },
    nativeUsd: 4_000,
    weeks: weeks({ [V3_POOL]: 500 }),
  } as const;

  it("is there when everything was read", () => {
    expect(missedFeeYield(read)).not.toBeNull();
  });

  /* Another pool of the pair, on the position's chain, with a week of its own: ranked, and not this position's. */
  const OTHER = `0x${"1".repeat(40)}`;
  const BASE = chainById(8453);
  const onBase: V3PoolMetadata = { ...v3Pool, chainId: BASE.id, token0: token(USDC, "USDC", 6, BASE.id), token1: token(WETH, "WETH", 18, BASE.id) };

  it.each([
    ["the search was not read", { found: null }],
    [
      "the search listed only another pool of the pair",
      { found: { protocol: "v3", matches: [v3Match(500_000, 125, { ...v3Pool, id: OTHER })] }, weeks: weeks({ [V3_POOL]: 500, [OTHER]: 500 }) },
    ],
    ["the search listed a pool with its id on another chain", { found: { protocol: "v3", matches: [v3Match(500_000, 125, onBase)] } }],
    ["the position's pool is on another chain than the one read", { chain: BASE }],
    ["the search is the other protocol's", { found: { protocol: "v4", matches: [v4Match(25)] } }],
    ["the dollar price was not read", { nativeUsd: null }],
    ["the day table was not read", { weeks: null }],
    ["the pool was not among the week's busiest days", { weeks: weeks({ [`0x${"1".repeat(40)}`]: 500 }) }],
    ["what the pool holds was not read", { found: { protocol: "v3", matches: [{ ...v3Match(500_000, 125), reserves: null }] } }],
  ] as const)("is nothing when %s", (_label, change) => {
    expect(missedFeeYield({ ...read, ...change } as Parameters<typeof missedFeeYield>[0])).toBeNull();
  });
});
