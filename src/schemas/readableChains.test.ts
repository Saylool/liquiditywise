import { describe, expect, it } from "vitest";

import { V3_CHAINS, V4_CHAINS } from "../lib/chains/chains";
import { isReadableChain, READABLE_CHAIN_IDS } from "./primitives";

describe("the chains a figure may describe", () => {
  it("are, for v3, exactly the chains the application reads", () => {
    expect([...READABLE_CHAIN_IDS.v3]).toEqual(V3_CHAINS.map(({ id }) => id));
    expect(isReadableChain(130, "v3")).toBe(false);
  });

  it("are, for v4, exactly the chains the application reads v4 on", () => {
    expect([...READABLE_CHAIN_IDS.v4]).toEqual(V4_CHAINS.map(({ id }) => id));
  });

  it("take every chain but Celo for v4, and refuse a chain nothing reads", () => {
    for (const id of [1, 8453, 42161, 130, 10, 137, 56, 43114]) expect(isReadableChain(id, "v4")).toBe(true);
    expect(isReadableChain(42220, "v4")).toBe(false);
    expect(isReadableChain(324, "v4")).toBe(false);
  });

  it("take every chain but Unichain for v3, Celo among them, and refuse a chain nothing reads", () => {
    for (const id of [1, 8453, 42161, 10, 137, 56, 43114, 42220]) expect(isReadableChain(id, "v3")).toBe(true);
    expect(isReadableChain(324, "v3")).toBe(false);
  });
});
