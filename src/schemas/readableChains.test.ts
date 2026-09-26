import { describe, expect, it } from "vitest";

import { CHAINS, V4_CHAINS } from "../lib/chains/chains";
import { isReadableChain, READABLE_CHAIN_IDS } from "./primitives";

describe("the chains a figure may describe", () => {
  it("are, for v3, exactly the chains the application reads", () => {
    expect([...READABLE_CHAIN_IDS.v3]).toEqual(CHAINS.map(({ id }) => id));
  });

  it("are, for v4, exactly the chains the application reads v4 on", () => {
    expect([...READABLE_CHAIN_IDS.v4]).toEqual(V4_CHAINS.map(({ id }) => id));
  });

  it("take mainnet and Arbitrum for v4, and refuse Base, where no v4 subgraph answers", () => {
    expect(isReadableChain(1, "v4")).toBe(true);
    expect(isReadableChain(42161, "v4")).toBe(true);
    expect(isReadableChain(8453, "v4")).toBe(false);
  });

  it("take Base and Arbitrum for v3, and refuse a chain nothing reads", () => {
    expect(isReadableChain(8453, "v3")).toBe(true);
    expect(isReadableChain(42161, "v3")).toBe(true);
    expect(isReadableChain(10, "v3")).toBe(false);
  });
});
