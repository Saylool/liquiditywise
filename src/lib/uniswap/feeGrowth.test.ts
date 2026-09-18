import { describe, expect, it } from "vitest";

import { feeGrowthInside, uncollectedFee } from "./feeGrowth";

/*
 * Every number here was read from mainnet at block 26,006,326 on 2026-09-18.
 * Nothing is invented: the two v3 cases carry the answer `collect` itself gave
 * at that block, so the arithmetic is checked against the contract rather than
 * against a second copy of my own reasoning.
 */

/** USDC/WETH at 0.05%, the busiest pool on mainnet. */
const V3_POOL = {
  tickCurrent: 197_645,
  global0: 4_852_193_377_576_666_501_546_116_970_610_638n,
  global1: 2_067_214_846_119_853_526_891_492_223_331_663_181_046_540n,
};

describe("fee growth inside a live v3 range", () => {
  /* #998651: open, in range, and owed nothing at its last touch. */
  const position = {
    tickLower: 190_190,
    tickUpper: 200_570,
    liquidity: 2_204_989_653_163_776n,
    outsideLower0: BigInt("0x252d860c91fc5856a69bdd42f925"),
    outsideLower1: BigInt("0x32d48c4164c8265577742dbae3832129bd2"),
    outsideUpper0: BigInt("0x49eb6fa523bead6c0972921a478"),
    outsideUpper1: BigInt("0x9d2f0b7a681f9762b7354ee6544b368235"),
    insideLast0: 3_979_518_691_523_452_388_431_907_510_082_993n,
    insideLast1: 1_726_981_430_484_923_575_981_082_306_417_489_046_260_583n,
  };

  const inside = (token: 0 | 1) =>
    feeGrowthInside({
      global: token === 0 ? V3_POOL.global0 : V3_POOL.global1,
      outsideLower: token === 0 ? position.outsideLower0 : position.outsideLower1,
      outsideUpper: token === 0 ? position.outsideUpper0 : position.outsideUpper1,
      tickCurrent: V3_POOL.tickCurrent,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
    });

  it("reproduces the totals the pool holds inside the range", () => {
    expect(inside(0)).toBe(4_004_433_151_757_146_653_157_179_257_119_281n);
    expect(inside(1)).toBe(1_736_981_694_334_616_910_840_310_919_074_366_353_818_885n);
  });

  /* What `collect` returned for this token at the same block, to the unit. */
  it("earns what the contract itself would have paid out", () => {
    const fee = (token: 0 | 1) =>
      uncollectedFee({
        growthInside: inside(token),
        growthInsideLast: token === 0 ? position.insideLast0 : position.insideLast1,
        liquidity: position.liquidity,
        owed: 0n,
      });

    expect(fee(0)).toBe(161_442_767n);
    expect(fee(1)).toBe(64_800_531_737_822_263n);
  });

  it("adds what was already credited at the last touch", () => {
    expect(
      uncollectedFee({ growthInside: 10n, growthInsideLast: 10n, liquidity: 5n, owed: 77n }),
    ).toBe(77n);
  });
});

/*
 * #998463 in the same pool: a ten-tick range the price has left. The totals
 * inside it stopped moving when the price crossed out, so the position earns
 * nothing more however long it is held — and `collect` returned zero for it at
 * this block, which is the point. A range that is merely narrow still earns; a
 * range the price is outside does not.
 */
describe("a v3 range the price has left", () => {
  it("earns nothing further", () => {
    const inside = (global: bigint, outsideLower: bigint, outsideUpper: bigint) =>
      feeGrowthInside({
        global,
        outsideLower,
        outsideUpper,
        tickCurrent: V3_POOL.tickCurrent,
        tickLower: 184_220,
        tickUpper: 184_230,
      });

    const inside0 = inside(
      V3_POOL.global0,
      BigInt("0x14b669eb29879d61acb315f291"),
      BigInt("0xbfc9617fb0bd0b0a466e9679765c"),
    );
    const inside1 = inside(
      V3_POOL.global1,
      BigInt("0x165455ab638b5714ef1509c835812059d"),
      BigInt("0x13da8343206f21dbbc2a0a2c749e01fb486c"),
    );

    expect(inside0).toBe(3_888_254_251_807_185_632_354_520_772_346_827n);
    expect(inside1).toBe(1_729_014_571_598_556_134_851_080_587_320_257_787_019_983n);

    const liquidity = 3_397_635_186_717_387n;
    expect(
      uncollectedFee({ growthInside: inside0, growthInsideLast: inside0, liquidity, owed: 0n }),
    ).toBe(0n);
    expect(
      uncollectedFee({ growthInside: inside1, growthInsideLast: inside1, liquidity, owed: 0n }),
    ).toBe(0n);
  });
});

/*
 * v4 token #408630, in the UNI/ETH pool at 0.30%. The case this arithmetic
 * exists for: both of its stored snapshots sit a few hundred undecillion short
 * of 2^256, because the counter they came from has wrapped. Subtraction that
 * refused to wrap would report this position's earnings as roughly 10^41 times
 * the supply of either token.
 */
describe("a live v4 position whose counters have wrapped", () => {
  const pool = {
    tickCurrent: 56_882,
    global0: 1_049_886_968_774_206_711_029_294_787_979_372_349n,
    global1: 496_765_194_099_387_159_028_554_601_742_524_890_083n,
  };
  const position = {
    tickLower: 49_080,
    tickUpper: 60_420,
    liquidity: 163_324_202_946_321_571_656n,
    outsideLower0: 1_043_412_581_994_056_676_500_751_322_119_811_392n,
    outsideLower1: 494_246_338_488_515_851_793_835_528_733_714_641_141n,
    outsideUpper0: 584_239_982_846_199_634_679_248_260_161_579_693n,
    outsideUpper1: 330_060_705_998_428_380_703_412_919_250_005_959_616n,
    insideLast0:
      115_792_089_237_316_195_423_570_985_008_687_907_853_269_402_375_649_708_226_079_864_902_672_316_174_586n,
    insideLast1:
      115_792_089_237_316_195_423_570_985_008_687_907_852_940_773_823_574_492_506_454_380_403_459_201_333_951n,
  };

  it("keeps a wrapped snapshot as a small earning rather than an enormous one", () => {
    const fee = (token: 0 | 1) =>
      uncollectedFee({
        growthInside: feeGrowthInside({
          global: token === 0 ? pool.global0 : pool.global1,
          outsideLower: token === 0 ? position.outsideLower0 : position.outsideLower1,
          outsideUpper: token === 0 ? position.outsideUpper0 : position.outsideUpper1,
          tickCurrent: pool.tickCurrent,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
        }),
        growthInsideLast: token === 0 ? position.insideLast0 : position.insideLast1,
        liquidity: position.liquidity,
        owed: 0n,
      });

    expect(fee(0)).toBe(2_171_558_813_167_494n);
    expect(fee(1)).toBe(801_060_419_568_406_684n);
  });
});

/*
 * The three placements of the price, which decide which side of each tick's
 * stored total is the one inside the range. Built rather than read, because a
 * live pool shows one placement at a time.
 */
describe("where the price sits", () => {
  const shared = { global: 1_000n, outsideLower: 100n, outsideUpper: 250n, tickLower: -10, tickUpper: 10 };

  it("takes each tick's near side while the price is inside", () => {
    expect(feeGrowthInside({ ...shared, tickCurrent: 0 })).toBe(650n);
  });

  /*
   * Below the range, the far side of the lower tick is taken — and on these
   * invented numbers the result goes negative and wraps, which is the answer
   * and not a fault. A real pool's totals never let it: what is inside a range
   * cannot exceed what the pool has taken in altogether. Asserted in the wrapped
   * form rather than avoided, because the arithmetic here is uint256 throughout
   * and a version that clamped instead would quietly ruin the v4 case above.
   */
  it("takes the far side of the lower tick once the price is below it", () => {
    const TWO_POW_256 =
      115_792_089_237_316_195_423_570_985_008_687_907_853_269_984_665_640_564_039_457_584_007_913_129_639_936n;

    expect(feeGrowthInside({ ...shared, tickCurrent: -11 })).toBe(TWO_POW_256 - 150n);
  });

  it("takes the far side of the upper tick once the price is at or above it", () => {
    expect(feeGrowthInside({ ...shared, tickCurrent: 10 })).toBe(1_000n - 100n - (1_000n - 250n));
  });

  /* The boundaries are Uniswap's own: at or above the lower, strictly below the upper. */
  it("treats the lower tick as inside and the upper tick as outside", () => {
    expect(feeGrowthInside({ ...shared, tickCurrent: -10 })).toBe(
      feeGrowthInside({ ...shared, tickCurrent: 0 }),
    );
    expect(feeGrowthInside({ ...shared, tickCurrent: 10 })).not.toBe(
      feeGrowthInside({ ...shared, tickCurrent: 9 })
    );
  });
});

/*
 * XOR/WETH at 1%, token #1103011, read on 2026-09-18. A junk-token pool whose
 * fee growth has run past what the protocol can record: the share this position
 * is owed does not fit the `uint128` both managers keep it in, so there is no
 * figure to report. Left as its own case because it is the only one where the
 * right answer is to say nothing — and the numbers that come out of the
 * alternatives are what makes that worth a test: unwrapped it is 1.05 x 10^53,
 * wrapped it is 3.19 x 10^38, and `collect` offers 1.07 x 10^38.
 */
describe("a pool whose accounting has overflowed", () => {
  it("reports no figure rather than a meaningless one", () => {
    const earned = uncollectedFee({
      growthInside: (1n << 200n) + 5n,
      growthInsideLast: 5n,
      liquidity: 779_860_489_062_609_815_121_637_478_824_943n,
      owed: 0n,
    });

    expect(earned).toBeNull();
  });

  it("still answers right up to the edge of what fits", () => {
    const edge = (1n << 128n) - 1n;

    expect(uncollectedFee({ growthInside: 0n, growthInsideLast: 0n, liquidity: 0n, owed: edge })).toBe(
      edge,
    );
    expect(
      uncollectedFee({ growthInside: 0n, growthInsideLast: 0n, liquidity: 0n, owed: edge + 1n }),
    ).toBeNull();
  });
});
