import { describe, expect, it } from "vitest";

import type { DataResult, PoolSearchResults, Position, V4PoolSearchResults } from "../../schemas";
import type { PairPoolReaders } from "../advisor/readPairPools";
import { readPairPools } from "../advisor/readPairPools";
import { chainById, ETHEREUM } from "../chains/chains";
import type { V4PoolDays } from "../uniswap/ethereumV4PoolDays";
import { feeYieldReader } from "./leftRangeReads";

/*
 * The reads behind a left-range alert's yield line: the pair page's own, for
 * the position's chain and protocol, made once per pass, and never able to
 * throw into the alert.
 */

const FETCHED_AT = "2026-09-24T12:00:00.000Z"; // six and a half days into the window
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const V3_POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const V4_POOL = `0x${"ab".repeat(32)}`;

const token = (symbol: string, address: string, decimals: number, chainId = 1) => ({ chainId, address, symbol, decimals });

const v3Pool = (chainId = 1) => ({
  protocolVersion: "v3" as const,
  chainId,
  id: V3_POOL,
  token0: token("USDC", USDC, 6, chainId),
  token1: token("WETH", WETH, 18, chainId),
  feePpm: 500,
});

const v4Pool = {
  protocolVersion: "v4" as const,
  chainId: 1,
  id: V4_POOL,
  token0: token("USDC", USDC, 18),
  token1: token("WETH", WETH, 18),
  tickSpacing: 10,
  fee: { kind: "static" as const, feePpm: 500 },
  protocolFee: null,
  hookAddress: null,
};

/** Out of its range, on whichever pool and chain. */
const position = (pool: Position["pool"]): Position => ({
  tokenId: "7",
  pool,
  tickLower: 190_190,
  tickUpper: 200_570,
  lowerPrice: 0.00018,
  upperPrice: 0.00051,
  liquidity: "2204989653163776",
  uncollected: null,
  currentTick: 180_000,
  inRange: false,
});

const searched = <T,>(matches: unknown[]): DataResult<T> =>
  ({ status: "success", data: { terms: ["USDC", "WETH"], fetchedAt: FETCHED_AT, source: "x", matches } }) as unknown as DataResult<T>;

const card = (id: string, protocol: "v3" | "v4") =>
  protocol === "v3"
    ? {
        id,
        feeTier: "500",
        totalValueLockedUSD: "1",
        poolDayData: [],
        token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.00025" },
        token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
      }
    : {
        id,
        createdAtBlockNumber: "1",
        tickSpacing: "10",
        hooks: `0x${"0".repeat(40)}`,
        token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "18", derivedETH: "1" },
        token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
      };

const days = (protocol: "v3" | "v4", id: string, feesUsd: number): DataResult<V4PoolDays> => ({
  status: "success",
  data: {
    fetchedAt: FETCHED_AT,
    payload: {
      data: {
        poolDayDatas: [{ date: 1, volumeUSD: String(feesUsd * 2000), feesUSD: String(feesUsd), pool: card(id, protocol) }],
        ...(protocol === "v4" ? { poolManagers: [{ id: `0x${"0".repeat(39)}1` }] } : {}),
        _meta: { hasIndexingErrors: false },
      },
    },
  },
});

/** Every read answering, and each one counted: a $1,000,000 v3 pool and a v4 pool with 100 ether of depth. */
const counted = (overrides: Partial<PairPoolReaders> = {}) => {
  const asked: string[] = [];
  const readers: PairPoolReaders = {
    searchV3: async (terms, chainId) => {
      asked.push(`search v3 ${chainId} ${terms.join("/")}`);
      return searched<PoolSearchResults>([
        {
          pool: v3Pool(chainId),
          reserves: { token0: String(500_000n * 10n ** 6n), token1: String(125n * 10n ** 18n) },
          ethPrice: { token0: 1 / 4000, token1: 1 },
          exactSymbolMatches: 2,
        },
      ]);
    },
    searchV4: async (_terms, chainId) => {
      asked.push(`search v4 ${chainId}`);
      return searched<V4PoolSearchResults>([
        {
          pool: v4Pool,
          state: { liquidity: (50n * 10n ** 18n).toString(), sqrtPriceX96: (1n << 96n).toString() },
          ethPrice: { token0: 1, token1: 1 },
          exactSymbolMatches: 2,
        },
      ]);
    },
    daysV3: async (chainId) => {
      asked.push(`days v3 ${chainId}`);
      return days("v3", V3_POOL, 650);
    },
    daysV4: async (chainId) => {
      asked.push(`days v4 ${chainId}`);
      return days("v4", V4_POOL, 300);
    },
    nativeUsd: async (chainId, protocol) => {
      asked.push(`price ${protocol} ${chainId}`);
      return { status: "success", data: 4_000 };
    },
    ...overrides,
  };
  return { readers, asked };
};

describe("the reads behind a left-range alert's yield", () => {
  it("give exactly the pair page's figure for the position's pool", async () => {
    const { readers } = counted();
    const page = await readPairPools(["USDC", "WETH"], readers, [ETHEREUM]);
    const read = feeYieldReader(readers);

    const v3 = page.v3.ranked.find(({ pool }) => pool.id === V3_POOL)?.feeYield;
    const v4 = page.v4.ranked.find(({ pool }) => pool.id === V4_POOL)?.feeYield;
    expect(v3).toBeCloseTo((650 / 1_000_000) * (365 / 6.5), 10);
    expect(await read(position(v3Pool()), 1)).toBe(v3);
    expect(await read(position(v4Pool), 1)).toBe(v4);
  });

  it("ask the position's own chain and protocol, and nothing else", async () => {
    const { readers, asked } = counted();
    await feeYieldReader(readers)(position(v3Pool(8453)), 8453);

    expect(asked.sort()).toEqual(["days v3 8453", "price v3 8453", "search v3 8453 USDC/WETH"]);
  });

  it("are made once per pass, however many positions in the pool leave, and again on the next pass", async () => {
    const { readers, asked } = counted();
    const pass = feeYieldReader(readers);
    await pass(position(v3Pool()), 1);
    await pass({ ...position(v3Pool()), tokenId: "8" }, 1);
    expect(asked).toHaveLength(3);

    /* Another pool on the same chain and protocol shares the day table and the price, and searches its own pair. */
    await pass({ ...position({ ...v3Pool(), id: `0x${"1".repeat(40)}`, token1: token("WBTC", WETH, 8) }) }, 1);
    expect(asked.filter((entry) => entry.startsWith("search"))).toHaveLength(2);
    expect(asked).toHaveLength(4);

    await feeYieldReader(readers)(position(v3Pool()), 1);
    expect(asked).toHaveLength(7);
  });

  it("give nothing, and do not throw, when a reader throws — and do not ask it again that pass", async () => {
    const thrown: string[] = [];
    const { readers, asked } = counted({
      searchV3: async () => {
        throw new Error("the gateway went away");
      },
      onThrown: (where) => thrown.push(where),
    });
    const pass = feeYieldReader(readers);

    expect(await pass(position(v3Pool()), 1)).toBeNull();
    expect(await pass(position(v3Pool()), 1)).toBeNull();
    expect(thrown).toEqual(["ethereum v3 search"]);
    expect(asked.sort()).toEqual(["days v3 1", "price v3 1"]);
  });

  it("give nothing when a read answers unavailable", async () => {
    const unavailable = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } as const;

    expect(await feeYieldReader(counted({ daysV3: async () => unavailable }).readers)(position(v3Pool()), 1)).toBeNull();
    expect(await feeYieldReader(counted({ nativeUsd: async () => unavailable }).readers)(position(v3Pool()), 1)).toBeNull();
    expect(await feeYieldReader(counted({ searchV3: async () => unavailable }).readers)(position(v3Pool()), 1)).toBeNull();
  });

  it("ask nothing for a pair the search box would refuse", async () => {
    const { readers, asked } = counted();
    const odd = position({ ...v3Pool(), token1: token("W ETH", WETH, 18) });

    expect(await feeYieldReader(readers)(odd, 1)).toBeNull();
    expect(asked).toEqual([]);
  });

  it("name the chain of the link the position was read for", async () => {
    const { readers, asked } = counted();
    await feeYieldReader(readers)(position(v4Pool), chainById(130).id);

    expect(asked.sort()).toEqual(["days v4 130", "price v4 130", "search v4 130"]);
  });
});
