import { describe, expect, it } from "vitest";

import { ZERO_ADDRESS } from "../../schemas";
import { nativeCurrencyOn } from "./nativeCurrency";

describe("a chain's own currency", () => {
  it("is ether under the zero address on Ethereum and the rollups", () => {
    for (const id of [1, 8453, 42161, 130, 10] as const) {
      expect(nativeCurrencyOn(id)).toEqual({ chainId: id, address: ZERO_ADDRESS, symbol: "ETH", name: "Ether", decimals: 18 });
    }
  });

  it("is POL on Polygon, never called ether there", () => {
    expect(nativeCurrencyOn(137)).toEqual({
      chainId: 137,
      address: ZERO_ADDRESS,
      symbol: "POL",
      name: "Polygon Ecosystem Token",
      decimals: 18,
    });
  });

  it("is BNB on BNB Chain, AVAX on Avalanche and CELO on Celo, none of them called ether", () => {
    expect([56, 43114, 42220].map((id) => nativeCurrencyOn(id as 56))).toEqual([
      { chainId: 56, address: ZERO_ADDRESS, symbol: "BNB", name: "BNB", decimals: 18 },
      { chainId: 43114, address: ZERO_ADDRESS, symbol: "AVAX", name: "Avalanche", decimals: 18 },
      { chainId: 42220, address: ZERO_ADDRESS, symbol: "CELO", name: "Celo", decimals: 18 },
    ]);
  });
});
