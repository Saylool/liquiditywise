import { describe, expect, it, vi } from "vitest";

import type { DataResult } from "../../schemas";
import type { V4PoolDays } from "./ethereumV4PoolDays";
import { fetchEthereumV4TradedPools } from "./ethereumV4TradedPools";

const FETCHED_AT = "2026-09-15T12:00:00.000Z";
const POOL_ID = `0x${"e5".repeat(32)}`;
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";

const pool = {
  id: POOL_ID,
  createdAtBlockNumber: "21688329",
  tickSpacing: "10",
  hooks: `0x${"0".repeat(40)}`,
  token0: { id: `0x${"0".repeat(40)}`, symbol: "ETH", name: "Ether", decimals: "18", derivedETH: "1" },
  token1: { id: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
};

/** The week's busiest pool-days: the same pool on two of its days. */
const payload = {
  data: {
    poolDayDatas: [{ pool }, { pool }],
    poolManagers: [{ id: POOL_MANAGER }],
    _meta: { hasIndexingErrors: false },
  },
};

const days = (value: DataResult<V4PoolDays>) => vi.fn(async () => value);

const run = (value: DataResult<V4PoolDays> = { status: "success", data: { payload, fetchedAt: FETCHED_AT } }) =>
  fetchEthereumV4TradedPools(days(value));

describe("fetchEthereumV4TradedPools", () => {
  it("names the chain the day table is on, and mainnet when not said", async () => {
    const read = { status: "success", data: { payload, fetchedAt: FETCHED_AT } } as const;
    const arbitrum = await fetchEthereumV4TradedPools(days(read), 42161);
    const mainnet = await fetchEthereumV4TradedPools(days(read));

    expect(arbitrum.status === "success" && arbitrum.data.pools[0]?.chainId).toBe(42161);
    expect(mainnet.status === "success" && mainnet.data.pools[0]?.chainId).toBe(1);
  });

  it("folds the days into pools, each once, with the time they were read", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools).toHaveLength(1);
    expect(result.data.pools[0]?.token0.symbol).toBe("ETH");
    expect(result.data.fetchedAt).toBe(FETCHED_AT);
  });

  /*
   * The chain is not asked here: every fee is unread, and the manager and the
   * creation blocks travel with the list for whoever reads it later.
   */
  it("publishes every fee unread, with the manager and the creation blocks", async () => {
    const result = await run();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools[0]?.fee).toEqual({ kind: "unread" });
    expect(result.data.poolManager).toBe(POOL_MANAGER);
    expect(result.data.createdAtBlockNumbers).toEqual({ [POOL_ID]: "21688329" });
  });

  /* The list is one read of the shared day table and nothing else. */
  it("reads the day table once and asks for nothing else", async () => {
    const readDays = days({ status: "success", data: { payload, fetchedAt: FETCHED_AT } });
    await fetchEthereumV4TradedPools(readDays);

    expect(readDays).toHaveBeenCalledTimes(1);
    expect(readDays).toHaveBeenCalledWith();
  });

  it("passes a failed read on with its own notice", async () => {
    const result = await run({
      status: "unavailable",
      reason: "configuration-error",
      notice: "market-data-not-configured",
    });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-not-configured");
    expect(result.status === "unavailable" && result.reason).toBe("configuration-error");
  });

  it("refuses a payload it cannot verify", async () => {
    const result = await run({ status: "success", data: { payload: { data: null }, fetchedAt: FETCHED_AT } });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-malformed");
  });
});
