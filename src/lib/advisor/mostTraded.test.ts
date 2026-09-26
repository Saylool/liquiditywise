import { describe, expect, it } from "vitest";

import {
  composeMostTradedV3,
  composeMostTradedV4,
  foldWeek,
  MOST_TRADED_SHOWN,
  v4WeekCandidates,
  type MostTradedList,
} from "./mostTraded";

const FETCHED_AT = "2026-09-24T12:00:00.000Z";
const DAY = 86_400;
const MONDAY = 1_790_208_000;
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const address = (index: number) => `0x${index.toString(16).padStart(40, "0")}`;

const v3Card = (index: number, feeTier = "500") => ({
  id: address(index),
  feeTier,
  totalValueLockedUSD: "1000000",
  poolDayData: [{ date: MONDAY }],
  token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
  token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
});

const day = <Card>(pool: Card, date: number, volume: string, fees: string) => ({
  date,
  volumeUSD: volume,
  feesUSD: fees,
  pool,
});

const v3Payload = (days: unknown[], meta = { hasIndexingErrors: false }) => ({
  data: { poolDayDatas: days, _meta: meta },
});

const listed = (list: MostTradedList) => {
  if (list.status !== "listed") throw new Error(`not listed: ${list.notice}`);
  return list.pools;
};

describe("adding a week up per pool", () => {
  it("sums each pool's days and orders the pools by the week's volume", () => {
    const weeks = foldWeek([
      day({ id: "a" }, MONDAY, "100", "1"),
      day({ id: "b" }, MONDAY, "150", "1.5"),
      day({ id: "a" }, MONDAY + DAY, "100", "1"),
    ]);

    expect(weeks.map(({ card, volumeUsd, feesUsd, daysCounted }) => [card.id, volumeUsd, feesUsd, daysCounted])).toEqual([
      ["a", 200, 2, 2],
      ["b", 150, 1.5, 1],
    ]);
  });

  it("keeps the source's order for a tie", () => {
    const weeks = foldWeek([day({ id: "b" }, MONDAY, "100", "0"), day({ id: "a" }, MONDAY, "100", "0")]);

    expect(weeks.map(({ card }) => card.id)).toEqual(["b", "a"]);
  });

  it("counts a day listed twice once, and a pool's id in either case as one pool", () => {
    const weeks = foldWeek([
      day({ id: "0xAB" }, MONDAY, "100", "1"),
      day({ id: "0xab" }, MONDAY, "100", "1"),
      day({ id: "0xab" }, MONDAY + DAY, "50", "0.5"),
    ]);

    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ volumeUsd: 150, feesUsd: 1.5, daysCounted: 2 });
  });

  it("leaves out a day whose volume is not a figure, rather than guessing it", () => {
    const weeks = foldWeek([day({ id: "a" }, MONDAY, "NaN", "1"), day({ id: "a" }, MONDAY + DAY, "100", "1")]);

    expect(weeks[0]).toMatchObject({ volumeUsd: 100, feesUsd: 1, daysCounted: 1 });
  });

  it("prints the fees as unknown when a day's fees are not a figure, not as a total short a day", () => {
    const weeks = foldWeek([day({ id: "a" }, MONDAY, "100", "-1"), day({ id: "a" }, MONDAY + DAY, "100", "1")]);

    expect(weeks[0]).toMatchObject({ volumeUsd: 200, feesUsd: null, daysCounted: 2 });
  });

  it("refuses fees larger than what was traded, which no pool could have charged", () => {
    const weeks = foldWeek([day({ id: "a" }, MONDAY, "100", "838.8608")]);

    expect(weeks[0]?.feesUsd).toBeNull();
  });

  it("keeps fees exactly equal to the volume, which is the edge and not past it", () => {
    expect(foldWeek([day({ id: "a" }, MONDAY, "100", "100")])[0]?.feesUsd).toBe(100);
  });
});

describe("the v3 half", () => {
  it("lists the week's busiest pools, verified, with what they traded and charged", () => {
    const pools = listed(
      composeMostTradedV3({
        payload: v3Payload([day(v3Card(1), MONDAY, "2000000", "1000"), day(v3Card(2, "3000"), MONDAY, "5000000", "15000")]),
        fetchedAt: FETCHED_AT,
      }),
    );

    expect(pools.map(({ pool }) => pool.id)).toEqual([address(2), address(1)]);
    expect(pools[0]).toMatchObject({ volumeUsd: 5_000_000, feesUsd: 15_000, daysCounted: 1, hookAltersSwaps: false });
    expect(pools[0]?.pool.protocolVersion).toBe("v3");
  });

  it("names the chain the day table was read on, on every pool", () => {
    const pools = listed(
      composeMostTradedV3({ payload: v3Payload([day(v3Card(1), MONDAY, "100", "0.05")]), fetchedAt: FETCHED_AT, chainId: 8453 }),
    );

    expect(pools.map(({ pool }) => pool.chainId)).toEqual([8453]);
  });

  it("shows no more than its share, however many pools traded", () => {
    const days = Array.from({ length: MOST_TRADED_SHOWN + 5 }, (_, index) =>
      day(v3Card(index + 1), MONDAY, String(1000 - index), "1"),
    );

    expect(listed(composeMostTradedV3({ payload: v3Payload(days), fetchedAt: FETCHED_AT }))).toHaveLength(MOST_TRADED_SHOWN);
  });

  it("skips a pool the card normaliser refuses, and fills its place with the next", () => {
    const days = [
      day({ ...v3Card(1), feeTier: "not a fee" }, MONDAY, "9000", "1"),
      ...Array.from({ length: MOST_TRADED_SHOWN }, (_, index) => day(v3Card(index + 2), MONDAY, String(1000 - index), "1")),
    ];
    const pools = listed(composeMostTradedV3({ payload: v3Payload(days), fetchedAt: FETCHED_AT }));

    expect(pools).toHaveLength(MOST_TRADED_SHOWN);
    expect(pools.map(({ pool }) => pool.id)).not.toContain(address(1));
  });

  it("says why when the source cannot be trusted", () => {
    expect(composeMostTradedV3({ payload: { nonsense: true }, fetchedAt: FETCHED_AT })).toEqual({
      status: "unavailable",
      notice: "market-data-malformed",
    });
    /* An answer with errors beside it is not trusted, however complete the rest looks. */
    expect(
      composeMostTradedV3({
        payload: { ...v3Payload([day(v3Card(1), MONDAY, "100", "0.05")]), errors: ["x"] },
        fetchedAt: FETCHED_AT,
      }),
    ).toEqual({ status: "unavailable", notice: "market-data-malformed" });
    expect(
      composeMostTradedV3({ payload: v3Payload([], { hasIndexingErrors: true }), fetchedAt: FETCHED_AT }),
    ).toEqual({ status: "unavailable", notice: "market-data-indexing-errors" });
  });

  it("carries the moment the week was read, not the moment the page was drawn", () => {
    const list = composeMostTradedV3({ payload: v3Payload([]), fetchedAt: FETCHED_AT });

    expect(list).toEqual({ status: "listed", pools: [], fetchedAt: FETCHED_AT });
  });
});

describe("the v4 half", () => {
  const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
  const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;
  const NO_HOOK = `0x${"0".repeat(40)}`;
  /* beforeSwap (bit 7): a hook that may rewrite what a swap costs. */
  const SWAP_HOOK = `0x${"1".repeat(36)}0080`;

  const v4Card = (index: number, hooks = NO_HOOK) => ({
    id: poolId(index),
    createdAtBlockNumber: "21688329",
    tickSpacing: "10",
    hooks,
    token0: { id: NO_HOOK, symbol: "ETH", name: "Ether", decimals: "18", derivedETH: "1" },
    token1: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
  });

  const v4Payload = (days: unknown[]) => ({
    data: { poolDayDatas: days, poolManagers: [{ id: POOL_MANAGER }], _meta: { hasIndexingErrors: false } },
  });

  const candidates = (days: unknown[]) => {
    const read = v4WeekCandidates(v4Payload(days));
    if ("status" in read) throw new Error("no candidates");
    return read;
  };

  it("names the pools to ask the chain about — the busiest weeks, no more than are shown — and the manager", () => {
    const days = Array.from({ length: MOST_TRADED_SHOWN + 3 }, (_, index) =>
      day(v4Card(index + 1), MONDAY, String(1000 - index), "1"),
    );
    const read = candidates(days);

    expect(read.weeks).toHaveLength(MOST_TRADED_SHOWN);
    expect(read.weeks[0]?.card.id).toBe(poolId(1));
    expect(read.poolManager).toBe(POOL_MANAGER);
  });

  it("takes each pool's fee from the chain, and marks the one it could not read", () => {
    const { weeks } = candidates([day(v4Card(1), MONDAY, "300", "0.15"), day(v4Card(2), MONDAY, "200", "0.1")]);
    const pools = listed(
      composeMostTradedV4({
        weeks,
        keys: new Map(),
        fees: new Map([[poolId(1), { lpFeePpm: 500, protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 } }]]),
        fetchedAt: FETCHED_AT,
      }),
    );

    expect(pools.map(({ pool }) => (pool.protocolVersion === "v4" ? pool.fee : null))).toEqual([
      { kind: "static", feePpm: 500 },
      { kind: "unread" },
    ]);
    expect(pools[0]).toMatchObject({ volumeUsd: 300, feesUsd: 0.15, hookAltersSwaps: false });
  });

  it("names the chain the day table was read on, on every pool", () => {
    const { weeks } = candidates([day(v4Card(1), MONDAY, "300", "0.15")]);
    const pools = listed(composeMostTradedV4({ weeks, keys: new Map(), fees: new Map(), fetchedAt: FETCHED_AT, chainId: 42161 }));

    expect(pools.map(({ pool }) => pool.chainId)).toEqual([42161]);
    expect(listed(composeMostTradedV4({ weeks, keys: new Map(), fees: new Map(), fetchedAt: FETCHED_AT }))[0]?.pool.chainId).toBe(1);
  });

  it("says so beside a pool whose hook may change what a swap costs", () => {
    const { weeks } = candidates([day(v4Card(1, SWAP_HOOK), MONDAY, "300", "0.15")]);
    const pools = listed(composeMostTradedV4({ weeks, keys: new Map(), fees: new Map(), fetchedAt: FETCHED_AT }));

    expect(pools[0]?.hookAltersSwaps).toBe(true);
  });

  it("says why when the day table cannot be trusted", () => {
    expect(v4WeekCandidates({ ...v4Payload([day(v4Card(1), MONDAY, "1", "0")]), errors: ["x"] })).toEqual({
      status: "unavailable",
      notice: "market-data-malformed",
    });
    expect(v4WeekCandidates({ data: { poolDayDatas: "nope" } })).toEqual({
      status: "unavailable",
      notice: "market-data-malformed",
    });
    expect(
      v4WeekCandidates({ data: { poolDayDatas: [], poolManagers: [], _meta: { hasIndexingErrors: true } } }),
    ).toEqual({ status: "unavailable", notice: "market-data-indexing-errors" });
  });
});
