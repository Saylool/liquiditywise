import { describe, expect, it } from "vitest";

import type { V3PoolMetadata, V4Pool } from "../../schemas";
import { chainById, ETHEREUM } from "../chains/chains";
import {
  annualisedFeeYield,
  composePairRow,
  everyNetworkLink,
  isThePair,
  PAIR_RANKING_FLOOR_USD,
  pairPoolHref,
  pairPoolsHref,
  poolWeeksFrom,
  type PairPoolRow,
  type PoolWeeks,
  rankPairPools,
  readPairInput,
  windowDaysAt,
} from "./pairPools";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const BASE = chainById(8453);

const address = (index: number) => `0x${index.toString(16).padStart(40, "0")}`;

const v3Pool = (index: number, chainId = 1): V3PoolMetadata => ({
  protocolVersion: "v3",
  chainId,
  id: address(index),
  token0: { chainId, address: USDC, symbol: "USDC", decimals: 6 },
  token1: { chainId, address: WETH, symbol: "WETH", decimals: 18 },
  feePpm: 500,
});

/** A hook whose address carries `beforeSwap` (bit 7): one that may change what a swap costs. */
const SWAP_HOOK = `0x${"1".repeat(36)}0080`;
/** A hook whose address carries only `afterInitialize` (bit 12): one that cannot. */
const QUIET_HOOK = `0x${"1".repeat(36)}1000`;

const v4Pool = (index: number, hookAddress: string | null = null): V4Pool => ({
  protocolVersion: "v4",
  chainId: 1,
  id: `0x${index.toString(16).padStart(64, "0")}`,
  token0: { chainId: 1, address: USDC, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
  tickSpacing: 10,
  fee: { kind: "static", feePpm: 500 },
  protocolFee: null,
  hookAddress,
});

/** Seven whole days, so a week's fees annualise by 365 / 7. */
const weeks = (entries: Record<string, { volumeUsd: number; feesUsd: number | null; daysCounted?: number }>): PoolWeeks => ({
  byPool: new Map(
    Object.entries(entries).map(([id, figures]) => [id, { daysCounted: 7, ...figures }]),
  ),
  windowDays: 7,
});

describe("reading what was typed as a pair", () => {
  it("reads two symbols by the search box's own rules", () => {
    expect(readPairInput("USDC/WETH")).toEqual({ kind: "pair", terms: ["USDC", "WETH"] });
    expect(readPairInput(" usdc - weth ")).toEqual({ kind: "pair", terms: ["usdc", "weth"] });
    expect(readPairInput("WETH USDC 0.05")).toEqual({ kind: "pair", terms: ["WETH", "USDC"] });
  });

  it("is not a pair with one symbol, the same symbol twice, or a pool's own id", () => {
    expect(readPairInput("USDC")).toEqual({ kind: "not-a-pair" });
    expect(readPairInput("usdc/USDC")).toEqual({ kind: "not-a-pair" });
    expect(readPairInput(address(5))).toEqual({ kind: "not-a-pair" });
    expect(readPairInput(`0x${"ab".repeat(32)}`)).toEqual({ kind: "not-a-pair" });
  });

  it("refuses what the search box refuses, for the same reason", () => {
    expect(readPairInput("   ")).toEqual({ kind: "unusable", reason: "empty" });
    expect(readPairInput("USDC/W")).toEqual({ kind: "unusable", reason: "length" });
    expect(readPairInput("$USDC/WETH")).toEqual({ kind: "unusable", reason: "unsupported-characters" });
  });

  it("matches a pool's two symbols exactly, either way round, ignoring case", () => {
    expect(isThePair(["usdc", "weth"], ["USDC", "WETH"])).toBe(true);
    expect(isThePair(["WETH", "USDC"], ["USDC", "WETH"])).toBe(true);
    /* The search matches substrings; the pair page does not. */
    expect(isThePair(["USDC", "WETH"], ["USDC", "MeWETH"])).toBe(false);
    /* No wrapped-or-native equivalence: to a pool these are two tokens. */
    expect(isThePair(["USDC", "WETH"], ["USDC", "ETH"])).toBe(false);
    expect(isThePair(["USDC", "WETH"], ["USDC", "USDC"])).toBe(false);
  });
});

describe("the week a yield is taken over", () => {
  it("covers six whole days and the part of today that had passed", () => {
    expect(windowDaysAt("2026-09-24T00:00:00.000Z")).toBe(6);
    expect(windowDaysAt("2026-09-24T12:00:00.000Z")).toBe(6.5);
    expect(windowDaysAt("not a time")).toBeNull();
  });

  it("folds a day table per pool, by the most-traded page's rule", () => {
    const card = (id: string) => ({
      id,
      feeTier: "500",
      totalValueLockedUSD: "1",
      poolDayData: [],
      token0: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
      token1: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
    });
    const folded = poolWeeksFrom("v3", {
      fetchedAt: "2026-09-24T12:00:00.000Z",
      payload: {
        data: {
          poolDayDatas: [
            { date: 1, volumeUSD: "1000", feesUSD: "0.5", pool: card(address(1).toUpperCase().replace("0X", "0x")) },
            { date: 2, volumeUSD: "3000", feesUSD: "1.5", pool: card(address(1)) },
            { date: 2, volumeUSD: "10", feesUSD: "20", pool: card(address(2)) },
          ],
          _meta: { hasIndexingErrors: false },
        },
      },
    });

    expect(folded?.windowDays).toBe(6.5);
    expect(folded?.byPool.get(address(1))).toEqual({ volumeUsd: 4000, feesUsd: 2, daysCounted: 2 });
    /* More charged than traded is not a fee. */
    expect(folded?.byPool.get(address(2))).toEqual({ volumeUsd: 10, feesUsd: null, daysCounted: 1 });
  });

  it("is no week at all when the day table is not a clean answer", () => {
    const at = "2026-09-24T12:00:00.000Z";
    expect(poolWeeksFrom("v3", { fetchedAt: at, payload: { nonsense: true } })).toBeNull();
    expect(poolWeeksFrom("v3", { fetchedAt: at, payload: { data: null, errors: [{}] } })).toBeNull();
    expect(
      poolWeeksFrom("v4", {
        fetchedAt: at,
        payload: { data: { poolDayDatas: [], poolManagers: [], _meta: { hasIndexingErrors: true } } },
      }),
    ).toBeNull();
  });
});

describe("the fee yield", () => {
  it("is past fees over current liquidity, scaled simply to a year", () => {
    expect(annualisedFeeYield(7_000, 1_000_000, 7)).toBeCloseTo(0.365, 10);
    expect(annualisedFeeYield(6_500, 1_000_000, 6.5)).toBeCloseTo(0.365, 10);
  });

  it("is no figure without liquidity or a window", () => {
    expect(annualisedFeeYield(10, 0, 7)).toBeNull();
    expect(annualisedFeeYield(10, 1_000, 0)).toBeNull();
    expect(annualisedFeeYield(Number.NaN, 1_000, 7)).toBeNull();
  });
});

describe("one pool's row", () => {
  const row = (overrides: Partial<Parameters<typeof composePairRow>[0]> = {}) =>
    composePairRow({
      chain: ETHEREUM,
      pool: v3Pool(1),
      liquidityInNative: 500,
      nativeUsd: 4_000,
      weeks: weeks({ [address(1)]: { volumeUsd: 14_000_000, feesUsd: 7_000 } }),
      ...overrides,
    });

  it("values the list's ether figure in dollars and ranks a pool above the floor", () => {
    const ranked = row();

    expect(ranked.liquidityUsd).toBe(2_000_000);
    expect(ranked.standing).toBe("ranked");
    expect(ranked.feeYield).toBeCloseTo(7_000 / 2_000_000 * (365 / 7), 10);
  });

  it("leaves a pool under the floor unranked and without a yield, however high it would be", () => {
    const thin = row({ liquidityInNative: 1, weeks: weeks({ [address(1)]: { volumeUsd: 1_000_000, feesUsd: 500 } }) });

    expect(thin.liquidityUsd).toBeLessThan(PAIR_RANKING_FLOOR_USD);
    expect(thin.standing).toBe("thin");
    expect(thin.feeYield).toBeNull();
  });

  it("is unmeasured where a figure the yield needs could not be had, and says which", () => {
    expect(row({ nativeUsd: null })).toMatchObject({ standing: "unmeasured", liquidityUsd: null });
    expect(row({ liquidityInNative: null })).toMatchObject({ standing: "unmeasured", liquidityUsd: null });
    expect(row({ weeks: null })).toMatchObject({ standing: "unmeasured", week: { status: "unread" } });
    expect(row({ weeks: weeks({}) })).toMatchObject({ standing: "unmeasured", week: { status: "quiet" } });
    expect(row({ weeks: weeks({ [address(1)]: { volumeUsd: 10, feesUsd: null } }) }).standing).toBe("unmeasured");
  });

  it("works out no yield behind a hook that may change what a swap costs, and keeps its fees", () => {
    const hooked = row({ pool: v4Pool(1, SWAP_HOOK), weeks: weeks({ [v4Pool(1).id]: { volumeUsd: 14_000_000, feesUsd: 7_000 } }) });

    expect(hooked.hookAltersSwaps).toBe(true);
    expect(hooked.standing).toBe("hook");
    expect(hooked.feeYield).toBeNull();
    expect(hooked.week).toMatchObject({ status: "counted", feesUsd: 7_000 });
  });

  it("ranks a v4 pool whose hook cannot touch a swap, as one with no hook", () => {
    for (const hook of [null, QUIET_HOOK]) {
      const plain = row({ pool: v4Pool(1, hook), weeks: weeks({ [v4Pool(1).id]: { volumeUsd: 14_000_000, feesUsd: 7_000 } }) });
      expect(plain.hookAltersSwaps, String(hook)).toBe(false);
      expect(plain.standing, String(hook)).toBe("ranked");
    }
  });
});

describe("the ranking", () => {
  const ranked = (id: number, liquidityUsd: number, feeYield: number, chain = ETHEREUM): PairPoolRow => ({
    chain,
    pool: v3Pool(id, chain.id),
    liquidityUsd,
    week: { status: "counted", volumeUsd: 1, feesUsd: 1, daysCounted: 7 },
    hookAltersSwaps: false,
    feeYield,
    standing: "ranked",
  });
  const other = (id: number, liquidityUsd: number | null, standing: PairPoolRow["standing"]): PairPoolRow => ({
    ...ranked(id, 0, 0),
    liquidityUsd,
    feeYield: null,
    standing,
  });

  it("puts the highest yield first across every chain, a tie to the larger pool", () => {
    const { ranked: order } = rankPairPools([
      ranked(1, 5_000_000, 0.1),
      ranked(2, 200_000, 0.4, BASE),
      ranked(3, 9_000_000, 0.1),
    ]);

    expect(order.map(({ pool }) => pool.id)).toEqual([address(2), address(3), address(1)]);
  });

  it("never lets a thin, hooked or unmeasured pool into the ranking, and lists them after it by size", () => {
    const { ranked: order, unranked } = rankPairPools([
      other(4, 900, "thin"),
      ranked(1, 5_000_000, 0.1),
      other(5, null, "unmeasured"),
      other(6, 50_000_000, "hook"),
    ]);

    expect(order.map(({ pool }) => pool.id)).toEqual([address(1)]);
    expect(unranked.map(({ pool }) => pool.id)).toEqual([address(6), address(4), address(5)]);
  });
});

describe("the links", () => {
  it("open each pool's own page, the chain unsaid on mainnet", () => {
    expect(pairPoolHref({ chain: ETHEREUM, pool: v3Pool(1) })).toBe(`/pool?address=${address(1)}`);
    expect(pairPoolHref({ chain: BASE, pool: v3Pool(1, 8453) })).toBe(`/pool?chain=base&address=${address(1)}`);
    expect(pairPoolHref({ chain: chainById(130), pool: v4Pool(1) })).toBe(`/v4?chain=unichain&id=${v4Pool(1).id}`);
  });

  it("lead to this page only for symbols the search box takes back as exactly that pair", () => {
    expect(pairPoolsHref("USDC", "WETH")).toBe("/pair?q=USDC%2FWETH");
    expect(pairPoolsHref("USDC.e", "WETH")).toBe("/pair?q=USDC.e%2FWETH");
    expect(pairPoolsHref("ez-SLP", "WETH")).toBeNull();
    expect(pairPoolsHref("USD Coin", "WETH")).toBeNull();
    expect(pairPoolsHref("USDC", "usdc")).toBeNull();
  });

  it("are labelled in the reader's language", () => {
    expect(everyNetworkLink(v3Pool(1), "en")).toEqual({ href: "/pair?q=USDC%2FWETH", label: "This pair on every network" });
    expect(everyNetworkLink(v3Pool(1), "tr")?.label).toBe("Bu parite tüm ağlarda");
    expect(everyNetworkLink({ token0: { symbol: "a b" }, token1: { symbol: "WETH" } }, "en")).toBeNull();
  });
});
