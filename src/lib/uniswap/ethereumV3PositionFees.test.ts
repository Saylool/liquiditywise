import { describe, expect, it } from "vitest";

import { fetchEthereumV3PositionFees } from "./ethereumV3PositionFees";
import type { Aggregate3Call, Aggregate3Result } from "./multicall3";
import { rpcEndpoint } from "./testing/multicall3Endpoint";
import { FEE_GROWTH_GLOBAL0_SELECTOR, FEE_GROWTH_GLOBAL1_SELECTOR, POOL_SLOT0_SELECTOR } from "./v3PoolFees";
import type { RawV3Position } from "./v3PositionManager";

/*
 * The fee read's second answer: the pool's price, from the same `slot0` the
 * fees were worked out at. The arithmetic of the fees themselves is checked
 * against the chain in feeGrowth.test.ts; this is about what comes back with it.
 */

const FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const Q128 = 1n << 128n;
/** About tick 197,645 on USDC/WETH: `1.0001^(197645 / 2) * 2^96`. */
const SQRT_PRICE = 1_550_499_574_899_706_142_130_401_485_783_040n;

const word = (value: bigint | number): string => BigInt.asUintN(256, BigInt(value)).toString(16).padStart(64, "0");
const answer = (...values: (bigint | number)[]): Aggregate3Result => ({ success: true, data: `0x${values.map(word).join("")}` });

const POSITION: RawV3Position = {
  tokenId: "998651",
  token0: USDC,
  token1: WETH,
  feePpm: 500,
  tickLower: -600,
  tickUpper: 600,
  liquidity: "1000",
  feeGrowthInside0Last: 5n * Q128,
  feeGrowthInside1Last: 1n * Q128,
  tokensOwed0: 3n,
  tokensOwed1: 4n,
};

/** A pool at tick 0 whose `slot0` carries the given price word, and ticks that leave 7 and 2 per unit inside. */
const pool =
  (sqrtPrice: bigint) =>
  (call: Aggregate3Call): Aggregate3Result =>
    call.data === POOL_SLOT0_SELECTOR
      ? answer(sqrtPrice, 0, 0, 0, 0, 0, 1)
      : call.data === FEE_GROWTH_GLOBAL0_SELECTOR
        ? answer(10n * Q128)
        : call.data === FEE_GROWTH_GLOBAL1_SELECTOR
          ? answer(4n * Q128)
          : call.data.endsWith(word(-600))
            ? answer(0, 0, 1n * Q128, 1n * Q128, 0, 0, 0, 1)
            : answer(0, 0, 2n * Q128, 1n * Q128, 0, 0, 0, 1);

const read = (sqrtPrice: bigint) =>
  fetchEthereumV3PositionFees({
    positions: [POSITION],
    factory: FACTORY,
    rpcUrl: "https://node.example.invalid/key",
    fetchImpl: rpcEndpoint({ call: pool(sqrtPrice) }),
    timeoutMs: 1_000,
  });

describe("the price the fees were worked out at", () => {
  it("comes back by token id, from the same slot0 answer", async () => {
    const result = await read(SQRT_PRICE);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.sqrtPrices).toEqual(new Map([["998651", SQRT_PRICE]]));
    /* Owed plus 1000 x (7 - 5) and 1000 x (2 - 1). */
    expect(result.data.fees.get("998651")).toEqual({ token0: "2003", token1: "1004" });
  });

  /* A word that is not a price costs the record, never the fees. */
  it("is left out when the word is not a price, and the fees are still read", async () => {
    const result = await read(0n);

    expect(result.status === "success" && result.data.sqrtPrices.size).toBe(0);
    expect(result.status === "success" && result.data.fees.get("998651")).toEqual({ token0: "2003", token1: "1004" });
  });

  it("is nothing, like the fees, when there is no position to read", async () => {
    const result = await fetchEthereumV3PositionFees({
      positions: [],
      factory: FACTORY,
      rpcUrl: undefined,
      fetchImpl: rpcEndpoint(),
    });

    expect(result).toEqual({ status: "success", data: { fees: new Map(), sqrtPrices: new Map() } });
  });
});
