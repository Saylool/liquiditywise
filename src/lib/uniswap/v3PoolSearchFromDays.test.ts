import { describe, expect, it, vi } from "vitest";

const reservesAskedFor = vi.hoisted(() => ({ pools: [] as { id: string; chainId: number }[] }));
vi.mock("./ethereumV3PoolReserves", () => ({
  fetchEthereumV3PoolReserves: async ({ pools }: { pools: { id: string; chainId: number }[] }) => {
    reservesAskedFor.pools = pools;
    return new Map();
  },
}));

import type { DataResult } from "../../schemas";
import { fetchV3PoolSearchFromDays } from "./ethereumV3PoolSearch";
import type { V4PoolDays } from "./ethereumV4PoolDays";

const NOW = new Date("2026-09-25T12:00:00.000Z");
const TODAY = 1_790_294_400;
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const CBBTC = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";

const card = (id: string, token0: [string, string], token1: [string, string]) => ({
  id,
  feeTier: "500",
  totalValueLockedUSD: "1000000",
  poolDayData: [{ date: TODAY }],
  token0: { id: token0[0], symbol: token0[1], name: token0[1], decimals: "18", derivedETH: "1" },
  token1: { id: token1[0], symbol: token1[1], name: token1[1], decimals: "6", derivedETH: "0.0004" },
});

const WETH_USDC = card(`0x${"a".repeat(40)}`, [WETH, "WETH"], [USDC, "USDC"]);
const WETH_CBBTC = card(`0x${"b".repeat(40)}`, [WETH, "WETH"], [CBBTC, "cbBTC"]);

const days = (...pools: unknown[]): DataResult<V4PoolDays> => ({
  status: "success",
  data: {
    fetchedAt: NOW.toISOString(),
    payload: {
      data: {
        poolDayDatas: pools.map((pool) => ({ date: TODAY, volumeUSD: "1000", feesUSD: "0.5", pool })),
        _meta: { hasIndexingErrors: false },
      },
    },
  },
});

const search = (terms: string[], read: DataResult<V4PoolDays> = days(WETH_USDC, WETH_CBBTC, WETH_USDC)) => {
  const readDays = vi.fn(async () => read);
  return {
    readDays,
    result: fetchV3PoolSearchFromDays({
      terms,
      chainId: 8453,
      readDays,
      rpcUrl: undefined,
      fetchImpl: vi.fn(),
      now: () => NOW,
    }),
  };
};

describe("a name search over the week's busiest pools", () => {
  it("finds the pools whose tokens match, each once, as the chain's", async () => {
    const result = await search(["weth", "usdc"]).result;

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.matches.map(({ pool }) => pool.id)).toEqual([WETH_USDC.id]);
    expect(result.data.matches[0]?.pool.chainId).toBe(8453);
  });

  it("matches a pair either way round, and a single term on either side", async () => {
    const reversed = await search(["usdc", "weth"]).result;
    const single = await search(["cbbtc"]).result;

    expect(reversed.status === "success" && reversed.data.matches.map(({ pool }) => pool.id)).toEqual([WETH_USDC.id]);
    expect(single.status === "success" && single.data.matches.map(({ pool }) => pool.id)).toEqual([WETH_CBBTC.id]);
  });

  it("reads nothing for terms it refuses", async () => {
    const { readDays, result } = search([""]);

    expect((await result).status).toBe("unavailable");
    expect(readDays).not.toHaveBeenCalled();
  });

  it("says why when the week could not be read, or was not what it should be", async () => {
    const down = await search(["weth"], { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" }).result;
    const garbled = await search(["weth"], { status: "success", data: { fetchedAt: NOW.toISOString(), payload: { nope: 1 } } })
      .result;

    expect(down).toMatchObject({ status: "unavailable", notice: "market-data-timed-out" });
    expect(garbled).toMatchObject({ status: "unavailable", notice: "market-data-malformed" });
  });
});

describe("the net a week of days makes", () => {
  it("counts each pool once, so a busy pool's many days leave room for the others that match", async () => {
    const other = card(`0x${"c".repeat(40)}`, [WETH, "WETH"], [USDC, "USDC"]);
    const busyWeek = [...Array.from({ length: 30 }, () => WETH_USDC), other];

    const result = await search(["weth", "usdc"], days(...busyWeek)).result;

    expect(result.status === "success" && result.data.matches.map(({ pool }) => pool.id).sort()).toEqual(
      [WETH_USDC.id, other.id].sort(),
    );
  });

  it("asks the chain what the matching pools hold, as that chain's pools", async () => {
    await search(["weth", "usdc"]).result;

    expect(reservesAskedFor.pools.map(({ id, chainId }) => [id, chainId])).toEqual([[WETH_USDC.id, 8453]]);
  });
});
