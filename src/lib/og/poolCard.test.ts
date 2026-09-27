import { describe, expect, it } from "vitest";

import type { V3Pool, V4Pool } from "../../schemas";
import { poolCardPath, poolCardText, poolShareMetadata } from "./poolCard";

const token = (symbol: string) => ({ chainId: 1, symbol, decimals: 18, address: `0x${"1".repeat(40)}` });
const v3 = { protocolVersion: "v3", chainId: 8453, id: "0x1", feePpm: 500, token0: token("WETH"), token1: token("USDC") } as unknown as V3Pool;
const v4 = (fee: unknown) =>
  ({ protocolVersion: "v4", chainId: 130, id: "0x2", fee, token0: token("ETH"), token1: token("USDC") }) as unknown as V4Pool;

describe("a pool's share card", () => {
  it("names the pair, the protocol, the fee and the chain", () => {
    expect(poolCardText(v3)).toEqual({ pair: "WETH / USDC", detail: "Uniswap v3 · 0.05% · Base" });
    expect(poolCardText(v4({ kind: "static", feePpm: 3000 }))).toEqual({ pair: "ETH / USDC", detail: "Uniswap v4 · 0.30% · Unichain" });
  });

  it("says a dynamic fee is dynamic, and leaves out a fee it could not read rather than guessing one", () => {
    expect(poolCardText(v4({ kind: "dynamic", currentFeePpm: null })).detail).toBe("Uniswap v4 · dynamic fee · Unichain");
    expect(poolCardText(v4({ kind: "unread" })).detail).toBe("Uniswap v4 · Unichain");
  });

  it("is drawn at an address that names the chain only off mainnet", () => {
    expect(poolCardPath("v3", "0xabc", "ethereum")).toBe("/og/pool?protocol=v3&id=0xabc");
    expect(poolCardPath("v4", "0xdef", "arbitrum")).toBe("/og/pool?protocol=v4&id=0xdef&chain=arbitrum");
  });

  it("goes into a page's share metadata as a large card, with the page's own title", () => {
    const metadata = poolShareMetadata("/og/pool?protocol=v3&id=0xabc", "Pool", "About it");

    expect(metadata.openGraph).toMatchObject({ title: "Pool", images: [{ url: "/og/pool?protocol=v3&id=0xabc", width: 1200, height: 630 }] });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: ["/og/pool?protocol=v3&id=0xabc"] });
  });
});
