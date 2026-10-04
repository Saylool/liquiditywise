import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const asked = vi.hoisted(() => ({ v3: [] as unknown[][], v4: [] as unknown[][], fail: false }));
const pool = (protocolVersion: string, chainId: number) => ({
  protocolVersion,
  chainId,
  id: "0x",
  feePpm: 500,
  fee: { kind: "static", feePpm: 500 },
  token0: { symbol: "WETH" },
  token1: { symbol: "USDC" },
});
vi.mock("../uniswap/getEthereumV3Pool", () => ({
  getEthereumV3Pool: async (id: string, chainId: number) => {
    asked.v3.push([id, chainId]);
    return asked.fail ? { status: "unavailable" } : { status: "success", data: pool("v3", chainId) };
  },
}));
vi.mock("../uniswap/getEthereumV4Pool", () => ({
  getEthereumV4Pool: async (id: string, chainId: number) => {
    asked.v4.push([id, chainId]);
    return { status: "success", data: pool("v4", chainId) };
  },
}));

import { forgetPoolCards, readPoolCard } from "./readPoolCard";

const ADDRESS = `0x${"ab".repeat(20)}`;
const ID = `0x${"cd".repeat(32)}`;
const read = (query: string) => readPoolCard(new URLSearchParams(query));

beforeEach(() => {
  asked.v3 = [];
  asked.v4 = [];
  asked.fail = false;
  forgetPoolCards();
});

describe("reading a pool's card", () => {
  it("reads the pool on the chain it names, mainnet when it names none, and once a day", async () => {
    expect(await read(`protocol=v3&id=${ADDRESS}`)).toEqual({ pair: "WETH / USDC", detail: "Uniswap v3 · 0.05% · Ethereum" });
    await read(`protocol=v3&id=${ADDRESS.toUpperCase().replace("0X", "0x")}`);
    await read(`protocol=v4&id=${ID}&chain=unichain`);

    expect(asked.v3).toEqual([[ADDRESS, 1]]);
    expect(asked.v4).toEqual([[ID, 130]]);
  });

  it("draws nothing it cannot read, and asks nothing for a request that is not a pool here", async () => {
    expect(await read(`protocol=v3&id=${ADDRESS}&chain=unichain`)).toBeNull();
    expect(await read(`protocol=v3&id=nope`)).toBeNull();
    expect(await read(`protocol=v4&id=${ADDRESS}`)).toBeNull();
    expect(await read(`protocol=v5&id=${ADDRESS}`)).toBeNull();
    expect(await read(`protocol=v3&id=${ADDRESS}&chain=solana`)).toBeNull();

    expect([asked.v3.length, asked.v4.length]).toEqual([0, 0]);
  });

  it("names BNB Chain, Avalanche and Celo on their cards, and draws no v4 card on Celo, where v4 is not read", async () => {
    expect(await read(`protocol=v4&id=${ID}&chain=bnb`)).toEqual({ pair: "WETH / USDC", detail: "Uniswap v4 · 0.05% · BNB Chain" });
    expect(await read(`protocol=v3&id=${ADDRESS}&chain=avalanche`)).toEqual({
      pair: "WETH / USDC",
      detail: "Uniswap v3 · 0.05% · Avalanche",
    });
    expect(await read(`protocol=v3&id=${ADDRESS}&chain=celo`)).toEqual({ pair: "WETH / USDC", detail: "Uniswap v3 · 0.05% · Celo" });
    expect(await read(`protocol=v4&id=${ID}&chain=celo`)).toBeNull();

    expect(asked.v4).toEqual([[ID, 56]]);
    expect(asked.v3).toEqual([
      [ADDRESS, 43114],
      [ADDRESS, 42220],
    ]);
  });

  it("does not keep a pool it could not read, and asks again", async () => {
    asked.fail = true;
    expect(await read(`protocol=v3&id=${ADDRESS}`)).toBeNull();
    asked.fail = false;
    expect(await read(`protocol=v3&id=${ADDRESS}`)).not.toBeNull();

    expect(asked.v3).toHaveLength(2);
  });
});
