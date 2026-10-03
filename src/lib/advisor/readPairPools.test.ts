import { describe, expect, it, vi } from "vitest";

import type { DataResult, PoolSearchResults, V4PoolSearchResults } from "../../schemas";
import type { V4PoolDays } from "../uniswap/ethereumV4PoolDays";
import { type PairPoolReaders, readPairPools } from "./readPairPools";

/*
 * The pair page reads every network at once and must survive any one of them
 * failing: a search refused, a day table down, a price unread, a reader that
 * throws. Each case below costs exactly the network it happens on.
 */

const FETCHED_AT = "2026-09-24T12:00:00.000Z"; // six and a half days into the window
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const SWAP_HOOK = `0x${"1".repeat(36)}0080`;

const address = (chainId: number, index: number) => `0x${(chainId * 100 + index).toString(16).padStart(40, "0")}`;
const poolId = (chainId: number, index: number) => `0x${(chainId * 100 + index).toString(16).padStart(64, "0")}`;
const token = (chainId: number, symbol: string, tokenAddress: string, decimals: number) => ({
  chainId,
  address: tokenAddress,
  symbol,
  decimals,
});

/** A v3 match holding `usdc` USDC and `weth` WETH, at USDC = 1/4000 ETH. */
const v3Match = (chainId: number, index: number, usdc: number, weth: number, symbol1 = "WETH") => ({
  pool: {
    protocolVersion: "v3" as const,
    chainId,
    id: address(chainId, index),
    token0: token(chainId, "USDC", USDC, 6),
    token1: token(chainId, symbol1, WETH, 18),
    feePpm: 500,
  },
  reserves: { token0: String(BigInt(usdc) * 10n ** 6n), token1: String(BigInt(weth) * 10n ** 18n) },
  ethPrice: { token0: 1 / 4000, token1: 1 },
  exactSymbolMatches: 2,
});

/** A v4 match with depth `L = 2^96` at price one, which is one of each token: a little over one ether. */
const v4Match = (chainId: number, index: number, hookAddress: string | null = null) => ({
  pool: {
    protocolVersion: "v4" as const,
    chainId,
    id: poolId(chainId, index),
    token0: token(chainId, "USDC", USDC, 18),
    token1: token(chainId, "WETH", WETH, 18),
    tickSpacing: 10,
    fee: { kind: "static" as const, feePpm: 500 },
    protocolFee: null,
    hookAddress,
  },
  state: { liquidity: (10n ** 23n).toString(), sqrtPriceX96: (1n << 96n).toString() },
  ethPrice: { token0: 1, token1: 1 },
  exactSymbolMatches: 2,
});

const searched = <T,>(matches: unknown[]): DataResult<T> =>
  ({ status: "success", data: { terms: ["USDC", "WETH"], fetchedAt: FETCHED_AT, source: "x", matches } }) as unknown as DataResult<T>;

const v3Card = (id: string) => ({
  id,
  feeTier: "500",
  totalValueLockedUSD: "1",
  poolDayData: [],
  token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.00025" },
  token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
});
const v4Card = (id: string) => ({
  id,
  createdAtBlockNumber: "1",
  tickSpacing: "10",
  hooks: `0x${"0".repeat(40)}`,
  token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "18", derivedETH: "1" },
  token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
});

/** One day per pool, charging `fees`. */
const days = (protocol: "v3" | "v4", fees: Record<string, number>): DataResult<V4PoolDays> => ({
  status: "success",
  data: {
    fetchedAt: FETCHED_AT,
    payload: {
      data: {
        poolDayDatas: Object.entries(fees).map(([id, charged]) => ({
          date: 1,
          volumeUSD: String(charged * 2000),
          feesUSD: String(charged),
          pool: protocol === "v3" ? v3Card(id) : v4Card(id),
        })),
        ...(protocol === "v4" ? { poolManagers: [{ id: address(0, 0) }] } : {}),
        _meta: { hasIndexingErrors: false },
      },
    },
  },
});

const unavailable = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } as const;

/** Every network answering: one 0.05% USDC/WETH pool worth $1,000,000 on each v3 chain, one v4 pool on each. */
const readers = (overrides: Partial<PairPoolReaders> = {}): PairPoolReaders => ({
  searchV3: async (_terms, chainId) =>
    searched<PoolSearchResults>([v3Match(chainId, 1, 500_000, 125), v3Match(chainId, 2, 1, 1, "MeWETH")]),
  searchV4: async (_terms, chainId) => searched<V4PoolSearchResults>([v4Match(chainId, 1)]),
  daysV3: async (chainId) => days("v3", { [address(chainId, 1)]: chainId === 8453 ? 6_500 : 650 }),
  daysV4: async (chainId) => days("v4", { [poolId(chainId, 1)]: 1 }),
  nativeUsd: async () => ({ status: "success", data: 4_000 }),
  ...overrides,
});

describe("one pair on every network", () => {
  it("prices each protocol's pools in that protocol's own subgraph's currency, never the other's", async () => {
    /* Polygon as measured: v3 priced in ETH, v4 in POL. */
    const pools = await readPairPools(
      ["usdc", "weth"],
      readers({ nativeUsd: async (_chainId, protocol) => ({ status: "success", data: protocol === "v3" ? 2_677 : 0.108 }) }),
    );

    const atOnePrice = await readPairPools(["usdc", "weth"], readers({ nativeUsd: async () => ({ status: "success", data: 1 }) }));

    const polygon = (half: typeof pools.v3) =>
      [...half.ranked, ...half.unranked].find(({ chain, liquidityUsd }) => chain.slug === "polygon" && liquidityUsd !== null)?.liquidityUsd;
    expect(polygon(pools.v3)).toBeCloseTo((polygon(atOnePrice.v3) ?? NaN) * 2_677, 6);
    expect(polygon(pools.v4)).toBeCloseTo((polygon(atOnePrice.v4) ?? NaN) * 0.108, 6);
  });

  it("asks every network at once: a search and a price per protocol it reads", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const asked = { v3: [] as number[], v4: [] as number[], price: [] as string[] };
    const base = readers();
    const reading = readPairPools(["USDC", "WETH"], {
      ...base,
      searchV3: async (terms, chainId) => {
        asked.v3.push(chainId);
        await gate;
        return base.searchV3(terms, chainId);
      },
      searchV4: async (terms, chainId) => {
        asked.v4.push(chainId);
        await gate;
        return base.searchV4(terms, chainId);
      },
      nativeUsd: async (chainId, protocol) => {
        asked.price.push(`${chainId}:${protocol}`);
        await gate;
        return base.nativeUsd(chainId, protocol);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    /* Every read has started before any has answered: none waits on another network. */
    expect(asked.v3.sort((left, right) => left - right)).toEqual([1, 10, 137, 8453, 42161]);
    expect(asked.v4.sort((left, right) => left - right)).toEqual([1, 10, 130, 137, 8453, 42161]);
    expect(asked.price.sort()).toEqual(
      ["1:v3", "1:v4", "10:v3", "10:v4", "130:v4", "137:v3", "137:v4", "42161:v3", "42161:v4", "8453:v3", "8453:v4"].sort(),
    );
    release();
    await reading;
  });

  it("lists only the exact pair, ranks across networks by yield, and names every network read", async () => {
    const pools = await readPairPools(["usdc", "weth"], readers());

    expect(pools.v3.ranked.map(({ chain }) => chain.slug)).toEqual(["base", "ethereum", "optimism", "polygon", "arbitrum"]);
    expect(pools.v3.ranked.every(({ pool }) => pool.token1.symbol === "WETH")).toBe(true);
    expect(pools.v3.ranked[0]?.liquidityUsd).toBeCloseTo(1_000_000, 6);
    expect(pools.v3.ranked[0]?.feeYield).toBeCloseTo((6_500 / 1_000_000) * (365 / 6.5), 10);
    expect(pools.v3.chains.map(({ chain, status }) => [chain.slug, status])).toEqual([
      ["ethereum", "read"],
      ["base", "read"],
      ["arbitrum", "read"],
      ["optimism", "read"],
      ["polygon", "read"],
    ]);
    /* Unichain is read for v4 alone. */
    expect(pools.v4.chains.map(({ chain }) => chain.slug)).toContain("unichain");
    expect(pools.v3.chains.map(({ chain }) => chain.slug)).not.toContain("unichain");
  });

  it("lists a network whose search failed as unread, and costs the others nothing", async () => {
    const pools = await readPairPools(
      ["USDC", "WETH"],
      readers({
        searchV3: async (_terms, chainId) =>
          chainId === 8453 ? unavailable : searched<PoolSearchResults>([v3Match(chainId, 1, 500_000, 125)]),
      }),
    );

    expect(pools.v3.chains.find(({ chain }) => chain.slug === "base")).toMatchObject({
      status: "unavailable",
      notice: "market-data-timed-out",
    });
    expect(pools.v3.ranked.map(({ chain }) => chain.slug)).toEqual(["ethereum", "optimism", "polygon", "arbitrum"]);
    /* Base's v4 search answered, and is listed. */
    expect(pools.v4.chains.find(({ chain }) => chain.slug === "base")?.status).toBe("read");
  });

  it("survives a reader that throws, says so, and reads every other network", async () => {
    const onThrown = vi.fn();
    const pools = await readPairPools(
      ["USDC", "WETH"],
      readers({
        onThrown,
        searchV4: async (_terms, chainId) => {
          if (chainId === 130) throw new Error("boom");
          return searched<V4PoolSearchResults>([v4Match(chainId, 1)]);
        },
        nativeUsd: async (chainId, protocol) => {
          if (chainId === 10 && protocol === "v3") throw new Error("boom");
          return { status: "success", data: 4_000 };
        },
      }),
    );

    expect(onThrown.mock.calls.map(([where]) => where).sort()).toEqual(["optimism v3 price", "unichain v4 search"]);
    expect(pools.v4.chains.find(({ chain }) => chain.slug === "unichain")).toMatchObject({
      status: "unavailable",
      notice: "market-data-unreachable",
    });
    /* OP Mainnet's pools are still listed — without a dollar value, so unranked. */
    const optimism = pools.v3.unranked.find(({ chain }) => chain.slug === "optimism");
    expect(optimism).toMatchObject({ standing: "unmeasured", liquidityUsd: null });
    expect(pools.v3.ranked.map(({ chain }) => chain.slug)).not.toContain("optimism");
  });

  it("keeps a network's pools when only its day table failed, unranked and said to be unread", async () => {
    const pools = await readPairPools(
      ["USDC", "WETH"],
      readers({ daysV3: async (chainId) => (chainId === 42161 ? unavailable : days("v3", { [address(chainId, 1)]: 650 })) }),
    );

    expect(pools.v3.unranked.find(({ chain }) => chain.slug === "arbitrum")).toMatchObject({
      standing: "unmeasured",
      week: { status: "unread" },
    });
    expect(pools.v3.chains.find(({ chain }) => chain.slug === "arbitrum")?.status).toBe("read");
  });

  it("works out no yield for a pool behind a swap-altering hook, and keeps its fees", async () => {
    const pools = await readPairPools(
      ["USDC", "WETH"],
      readers({ searchV4: async (_terms, chainId) => searched<V4PoolSearchResults>([v4Match(chainId, 1, SWAP_HOOK)]) }),
    );

    expect(pools.v4.ranked).toEqual([]);
    expect(pools.v4.unranked.every(({ standing, hookAltersSwaps }) => standing === "hook" && hookAltersSwaps)).toBe(true);
  });

  it("does not rank a pool under the floor, however much it charged", async () => {
    const pools = await readPairPools(
      ["USDC", "WETH"],
      readers({
        searchV3: async (_terms, chainId) =>
          searched<PoolSearchResults>([v3Match(chainId, 1, 500_000, 125), ...(chainId === 1 ? [v3Match(1, 3, 100, 0)] : [])]),
        daysV3: async (chainId) => days("v3", { [address(chainId, 1)]: 650, ...(chainId === 1 ? { [address(1, 3)]: 50 } : {}) }),
      }),
    );

    const thin = pools.v3.unranked.find(({ pool }) => pool.id === address(1, 3));
    expect(thin).toMatchObject({ standing: "thin", feeYield: null });
    expect(pools.v3.ranked.map(({ pool }) => pool.id)).not.toContain(address(1, 3));
  });
});
