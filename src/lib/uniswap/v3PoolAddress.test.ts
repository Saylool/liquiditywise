import { describe, expect, it } from "vitest";

import { V3_POOL_INIT_CODE_HASH, v3PoolAddress } from "./v3PoolAddress";

/*
 * A live position and the pool the indexer publishes for it, read on
 * 2026-09-18: token #1112391, XOR/WETH at the 1% tier. The factory is the one
 * the position manager reports for itself, not a written-down address.
 */
const FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";
const XOR = "0x40fd72257597aa14c7231a7b1aaa29fce868f677";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const POOL = "0x7f63306a62c345365881e0fff85cb2c8baaa13d5";

const derive = (overrides: Partial<Parameters<typeof v3PoolAddress>[0]> = {}) =>
  v3PoolAddress({ factory: FACTORY, token0: XOR, token1: WETH, feePpm: 10_000, ...overrides });

describe("v3PoolAddress", () => {
  it("lands on the address the indexer publishes for a live position", () => {
    expect(derive()).toBe(POOL);
  });

  /*
   * The control that says the inputs are doing the work. Change any one of the
   * four and the answer must move — a derivation that ignored an argument would
   * still return a well-formed address, and the check above would still pass.
   */
  it.each([
    ["the factory", { factory: "0xc36442b4a4522e871399cd717abdd847ab11fe88" }],
    ["the fee", { feePpm: 3_000 }],
    ["token0", { token0: "0x40fd72257597aa14c7231a7b1aaa29fce868f678" }],
    ["token1", { token1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc3" }],
  ])("moves when %s changes", (_label, overrides) => {
    expect(derive(overrides)).not.toBe(POOL);
    expect(derive(overrides)).toMatch(/^0x[0-9a-f]{40}$/);
  });

  /*
   * The factory sorts the pair before hashing, so an unsorted pair derives a
   * real-looking address with no pool at it — the one mistake here that would
   * send a read to a contract that does not exist and report it as a missing
   * position rather than as a bug.
   */
  it("refuses a pair the wrong way round", () => {
    expect(derive({ token0: WETH, token1: XOR })).toBeNull();
  });

  it("refuses a pair of one token", () => {
    expect(derive({ token1: XOR })).toBeNull();
  });

  it.each([
    ["a factory that is not an address", { factory: "0x1f98431c" }],
    ["an address in upper case", { token0: XOR.toUpperCase() }],
    ["a negative fee", { feePpm: -1 }],
    ["a fractional fee", { feePpm: 3_000.5 }],
  ])("refuses %s", (_label, overrides) => {
    expect(derive(overrides)).toBeNull();
  });

  it("pins the init code hash as a hash", () => {
    expect(V3_POOL_INIT_CODE_HASH).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
