import { describe, expect, it } from "vitest";

import { ZERO_ADDRESS } from "../../schemas";
import { nativeCurrencyOn } from "./nativeCurrency";

describe("a chain's own currency", () => {
  it("is ether under the zero address on every chain but Polygon", () => {
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
});
