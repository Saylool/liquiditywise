import { describe, expect, it } from "vitest";

import { keccak256, utf8Bytes } from "../crypto/keccak256";
import {
  decodeInitializeLog,
  DYNAMIC_FEE_FLAG,
  INITIALIZE_SIGNATURE,
  INITIALIZE_TOPIC,
  poolIdOf,
  type V4PoolKey,
} from "./v4PoolKey";

/*
 * Mainnet's busiest hooked pool, USDC/WETH behind hook 0x0000000aa232…, whose
 * key was read back from its Initialize log on 2026-09-15 and hashed to its id
 * — and fourteen more pools alongside it, every one of which recomputed.
 */
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const POOL_ID = "0xe500210c7ea6bfd9f69dce044b09ef384ec2b34832f132baec3b418208e3a657";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const HOOK = "0x0000000aa232009084bd71a5797d089aa4edfad4";
const HOOKED_KEY: V4PoolKey = {
  currency0: USDC,
  currency1: WETH,
  fee: DYNAMIC_FEE_FLAG,
  tickSpacing: 10,
  hooks: HOOK,
};

const word = (value: bigint) => value.toString(16).padStart(64, "0");
const addressWord = (address: string) => `0x${address.slice(2).padStart(64, "0")}`;

/** The log the PoolManager emits, built from a key the way the ABI lays it out. */
const logFor = (key: V4PoolKey, overrides: Partial<{ address: string; topics: string[]; data: string; poolId: string }> = {}) => {
  const spacing = BigInt(key.tickSpacing);
  return {
    address: overrides.address ?? POOL_MANAGER,
    topics: overrides.topics ?? [
      INITIALIZE_TOPIC,
      overrides.poolId ?? POOL_ID,
      addressWord(key.currency0),
      addressWord(key.currency1),
    ],
    data:
      overrides.data ??
      `0x${word(BigInt(key.fee))}${word(spacing)}${word(BigInt(key.hooks))}${word(1584563250285286751870879006n)}${word(BigInt(0x1000000 + -198_322))}`,
  };
};

describe("INITIALIZE_TOPIC", () => {
  /* The constant and the signature it abbreviates must agree. */
  it("is keccak256 of the event signature", () => {
    const hash = `0x${Array.from(keccak256(utf8Bytes(INITIALIZE_SIGNATURE)), (b) => b.toString(16).padStart(2, "0")).join("")}`;

    expect(hash).toBe(INITIALIZE_TOPIC);
  });
});

describe("poolIdOf", () => {
  /* Pinned against the chain: this key is what the PoolManager hashed to name the pool. */
  it("hashes the busiest hooked pool's key to its id", () => {
    expect(poolIdOf(HOOKED_KEY)).toBe(POOL_ID);
  });

  it("changes with every field of the key", () => {
    for (const changed of [
      { ...HOOKED_KEY, fee: 250 },
      { ...HOOKED_KEY, tickSpacing: 60 },
      { ...HOOKED_KEY, hooks: `0x${"0".repeat(40)}` },
      { ...HOOKED_KEY, currency0: `0x${"1".repeat(40)}` },
      { ...HOOKED_KEY, currency0: WETH, currency1: USDC },
    ]) {
      expect(poolIdOf(changed)).not.toBe(POOL_ID);
    }
  });

  it("refuses a key whose fields are not what a key holds", () => {
    expect(poolIdOf({ ...HOOKED_KEY, fee: 0x1000000 })).toBeNull();
    expect(poolIdOf({ ...HOOKED_KEY, fee: -1 })).toBeNull();
    expect(poolIdOf({ ...HOOKED_KEY, tickSpacing: 1.5 })).toBeNull();
    expect(poolIdOf({ ...HOOKED_KEY, tickSpacing: -10 })).toBeNull();
    expect(poolIdOf({ ...HOOKED_KEY, tickSpacing: 0x800000 })).toBeNull();
    expect(poolIdOf({ ...HOOKED_KEY, hooks: "0xabc" })).toBeNull();
  });
});

describe("decodeInitializeLog", () => {
  const expected = { poolManager: POOL_MANAGER, poolId: POOL_ID };

  it("reads the key back out of the pool's own Initialize log", () => {
    expect(decodeInitializeLog(logFor(HOOKED_KEY), expected)).toEqual(HOOKED_KEY);
  });

  it("reads a static fee and a hookless pool", () => {
    const key: V4PoolKey = { currency0: USDC, currency1: WETH, fee: 500, tickSpacing: 10, hooks: `0x${"0".repeat(40)}` };
    const id = poolIdOf(key);
    if (id === null) throw new Error("fixture key should hash");

    expect(decodeInitializeLog(logFor(key, { poolId: id }), { poolManager: POOL_MANAGER, poolId: id })).toEqual(key);
  });

  it("accepts the manager and the topics in any letter case", () => {
    const log = logFor(HOOKED_KEY);
    const shouted = { ...log, address: log.address.toUpperCase().replace("0X", "0x"), topics: log.topics.map((t) => t.toUpperCase().replace("0X", "0x")) };

    expect(decodeInitializeLog(shouted, expected)).toEqual(HOOKED_KEY);
  });

  /*
   * A log that is not this pool's, not the PoolManager's, or not an Initialize
   * at all. Each is refused on its own evidence, before any hashing.
   */
  it.each([
    ["another contract's log", logFor(HOOKED_KEY, { address: USDC })],
    ["a different event", logFor(HOOKED_KEY, { topics: [`0x${"1".repeat(64)}`, POOL_ID, addressWord(USDC), addressWord(WETH)] })],
    ["another pool's id in the topic", logFor(HOOKED_KEY, { poolId: `0x${"7a".repeat(32)}` })],
    ["too few topics", logFor(HOOKED_KEY, { topics: [INITIALIZE_TOPIC, POOL_ID] })],
    ["data of the wrong width", logFor(HOOKED_KEY, { data: `0x${word(250n)}` })],
    ["a currency topic that is not an address", logFor(HOOKED_KEY, { topics: [INITIALIZE_TOPIC, POOL_ID, `0x${"f".repeat(64)}`, addressWord(WETH)] })],
    ["not a log at all", { topics: "none" }],
  ])("refuses %s", (_label, log) => {
    expect(decodeInitializeLog(log, expected)).toBeNull();
  });

  /* The hash is the last word: a key that decodes cleanly but is not this pool's is still refused. */
  it("refuses a key that does not hash to the pool's id", () => {
    const wrongFee = logFor({ ...HOOKED_KEY, fee: 250 });

    expect(decodeInitializeLog(wrongFee, expected)).toBeNull();
  });

  /*
   * A word whose high bits are set is not the number the key holds, and the
   * hash says so: the low bits alone are read, and the key they make does not
   * hash to the id.
   */
  it("refuses a fee word wider than a uint24, by the hash", () => {
    const log = logFor(HOOKED_KEY);
    const data = `0x${word(BigInt(DYNAMIC_FEE_FLAG) | (1n << 24n))}${log.data.slice(2 + 64)}`;

    expect(decodeInitializeLog({ ...log, data }, expected)).toBeNull();
  });

  it("refuses a spacing word with bits above an int24, even when its low bits are a spacing", () => {
    const log = logFor(HOOKED_KEY);
    const data = `0x${log.data.slice(2, 2 + 64)}${word((1n << 24n) | 10n)}${log.data.slice(2 + 128)}`;

    expect(decodeInitializeLog({ ...log, data }, expected)).toBeNull();
  });

  it("refuses a spacing word that is negative, which no pool has", () => {
    const log = logFor(HOOKED_KEY);
    const data = `0x${log.data.slice(2, 2 + 64)}${word((1n << 256n) - 10n)}${log.data.slice(2 + 128)}`;

    expect(decodeInitializeLog({ ...log, data }, expected)).toBeNull();
  });
});
