import { describe, expect, it } from "vitest";

import {
  EXTSLOAD_SELECTOR,
  extsloadCalldata,
  LIQUIDITY_OFFSET,
  poolStateSlot,
  readStorageWord,
  SLOT0_OFFSET,
  unpackLiquidity,
  unpackSlot0,
} from "./v4PoolStateSlots";
import { keccak256Hex } from "../crypto/keccak256";

/** Mainnet's busiest hooked pool, USDC/WETH; its slot was read back from the chain. */
const POOL_ID = "0xe500210c7ea6bfd9f69dce044b09ef384ec2b34832f132baec3b418208e3a657";
const STATE_SLOT = "0x9562c77e4b5d35fd9cc398adeebe261d0a2fcaa1fb2694c99fe44c44eaa0b79a";

describe("poolStateSlot", () => {
  /*
   * Pinned against the chain, not against the hash: an `extsload` of this slot
   * plus three answered with exactly the liquidity the pool reported, for this
   * pool and twenty-three others.
   */
  it("locates the pool's state where the PoolManager keeps it", () => {
    expect(poolStateSlot(POOL_ID, SLOT0_OFFSET)).toBe(STATE_SLOT);
  });

  it("offsets the liquidity word three slots in", () => {
    expect(poolStateSlot(POOL_ID, LIQUIDITY_OFFSET)).toBe(
      `0x${(BigInt(STATE_SLOT) + 3n).toString(16).padStart(64, "0")}`,
    );
  });

  it("refuses an id that is not a 32-byte word", () => {
    expect(poolStateSlot(`0x${"a".repeat(40)}`, 0)).toBeNull();
    expect(poolStateSlot("", 0)).toBeNull();
  });

  it("refuses an offset that is not a whole non-negative number", () => {
    expect(poolStateSlot(POOL_ID, -1)).toBeNull();
    expect(poolStateSlot(POOL_ID, 1.5)).toBeNull();
  });
});

describe("extsloadCalldata", () => {
  it("prefixes the slot with the selector the PoolManager answers to", () => {
    expect(extsloadCalldata(STATE_SLOT)).toBe(`${EXTSLOAD_SELECTOR}${STATE_SLOT.slice(2)}`);
    expect(extsloadCalldata(STATE_SLOT)).toHaveLength(10 + 64);
  });

  /* The selector constant and the hash it abbreviates must agree. */
  it("uses the first four bytes of keccak256 of the signature", () => {
    const signature = Array.from("extsload(bytes32)", (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");

    expect(keccak256Hex(`0x${signature}`)?.slice(0, 10)).toBe(EXTSLOAD_SELECTOR);
  });
});

describe("readStorageWord", () => {
  it("reads a word", () => {
    expect(readStorageWord(`0x${"0".repeat(63)}5`)).toBe(5n);
  });

  /* A call to an address with no code answers "0x", which must not read as zero. */
  it.each(["0x", "", "0x12", 5, null, undefined, `0x${"0".repeat(65)}`])(
    "reports %j as no word at all",
    (value) => {
      expect(readStorageWord(value)).toBeNull();
    },
  );
});

describe("unpackSlot0", () => {
  /*
   * The layout, checked against a pool whose tick is negative: the ETH/USDC pool
   * at tick -198322 with the price the chain held at the time. A sign error here
   * would put every ETH pair twelve orders of magnitude from its real price.
   */
  it("unpacks a negative tick above a 160-bit price", () => {
    const sqrtPriceX96 = 3916044149203074036022610n;
    const tick = -198322;
    const word = (BigInt(tick + 0x1000000) << 160n) | sqrtPriceX96;

    expect(unpackSlot0(word)).toEqual({ sqrtPriceX96, tick });
  });

  it("unpacks a positive tick", () => {
    const word = (198320n << 160n) | 79242101521076757860230726452n;

    expect(unpackSlot0(word)).toEqual({ sqrtPriceX96: 79242101521076757860230726452n, tick: 198320 });
  });

  it("ignores the fee fields above the tick", () => {
    const word = (3000n << 208n) | (500n << 184n) | (5n << 160n) | 12345n;

    expect(unpackSlot0(word)).toEqual({ sqrtPriceX96: 12345n, tick: 5 });
  });
});

describe("unpackLiquidity", () => {
  it("reads the low 128 bits and nothing above them", () => {
    expect(unpackLiquidity((1n << 200n) | 871594992723282798n)).toBe(871594992723282798n);
  });
});
