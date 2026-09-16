import { describe, expect, it } from "vitest";

import type {
  DataResult,
  PoolCandidateList,
  V4PoolCandidateList,
} from "../../schemas";
import type { AddressBalances } from "../uniswap/ethereumBalances";
import { composeAddressHoldings, displayedV4Pools, withV4ChainReadings } from "./addressHoldings";

const ADDRESS = `0x${"a".repeat(40)}`;
const FETCHED_AT = "2026-09-15T12:00:00.000Z";
const NATIVE = `0x${"0".repeat(40)}`;

const token = (address: string, symbol: string, decimals: number) => ({
  chainId: 1,
  address,
  symbol,
  decimals,
});

const USDC = token(`0x${"1".repeat(40)}`, "USDC", 6);
const WETH = token(`0x${"b".repeat(40)}`, "WETH", 18);
const ETH = token(NATIVE, "ETH", 18);

const v3Pool = (id: string, feePpm = 500) => ({
  protocolVersion: "v3" as const,
  chainId: 1,
  id,
  token0: USDC,
  token1: WETH,
  feePpm,
});

const v4Pool = (id: string, hookAddress: string | null = null) => ({
  protocolVersion: "v4" as const,
  chainId: 1,
  id,
  token0: ETH,
  token1: USDC,
  tickSpacing: 10,
  fee: { kind: "static" as const, feePpm: 625 },
  protocolFee: null,
  hookAddress,
});

const V3_A = `0x${"5".repeat(40)}`;
const V3_B = `0x${"3".repeat(40)}`;
const V4_A = `0x${"e5".repeat(32)}`;

const v3List = (): DataResult<PoolCandidateList> => ({
  status: "success",
  data: { pools: [v3Pool(V3_A), v3Pool(V3_B, 3000)], fetchedAt: FETCHED_AT, source: "uniswap-v3-subgraph" },
});

const v4List = (): DataResult<V4PoolCandidateList> => ({
  status: "success",
  data: {
    pools: [v4Pool(V4_A)],
    poolManager: null,
    createdAtBlockNumbers: { [V4_A]: "21688329" },
    fetchedAt: FETCHED_AT,
    source: "uniswap-v4-subgraph",
  },
});

const unavailable = <T,>(): DataResult<T> => ({
  status: "unavailable",
  reason: "configuration-error",
  notice: "market-data-not-configured",
});

const balances = (held: { address: string; amount: string }[], checked = 10): DataResult<AddressBalances> => ({
  status: "success",
  data: { held, checked, unreadable: 0 },
});

const compose = (
  overrides: Partial<Parameters<typeof composeAddressHoldings>[0]> = {},
) =>
  composeAddressHoldings({
    address: ADDRESS,
    v3Candidates: v3List(),
    v4Candidates: v4List(),
    balances: balances([{ address: USDC.address, amount: "5000000" }]),
    fetchedAt: FETCHED_AT,
    ...overrides,
  });

const answered = (result: ReturnType<typeof compose>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  return result.data;
};

describe("composeAddressHoldings", () => {
  it("names each held currency from the lists and says which pools it opens", () => {
    const data = answered(compose());

    expect(data.holdings).toEqual([{ token: USDC, amount: "5000000" }]);
    expect(data.pools.map((entry) => [entry.pool.id, entry.heldSides])).toEqual([
      [V3_A, "token0"],
      [V3_B, "token0"],
      [V4_A, "token1"],
    ]);
  });

  /*
   * The point of the v4 net. Ether is not wrapped ether: holding it is one side
   * of a v4 ETH/USDC pool and no side of a v3 USDC/WETH one.
   */
  it("treats the chain's own ether as a holding, which opens a v4 pool on both sides", () => {
    const data = answered(
      compose({
        balances: balances([
          { address: NATIVE, amount: "1000000000000000000" },
          { address: USDC.address, amount: "5000000" },
        ]),
      }),
    );

    expect(data.holdings.map((holding) => holding.token.symbol)).toEqual(["ETH", "USDC"]);
    expect(data.pools[0]).toEqual({ pool: v4Pool(V4_A), heldSides: "both" });
    expect(data.pools.slice(1).every((entry) => entry.heldSides === "token0")).toBe(true);
  });

  it("puts both-sides pools first across both protocols", () => {
    const data = answered(
      compose({
        balances: balances([
          { address: NATIVE, amount: "1" },
          { address: USDC.address, amount: "1" },
          { address: WETH.address, amount: "1" },
        ]),
      }),
    );

    expect(data.pools.map((entry) => entry.heldSides)).toEqual(["both", "both", "both"]);
    expect(data.pools.map((entry) => entry.pool.protocolVersion)).toEqual(["v3", "v3", "v4"]);
  });

  it("records which nets were cast, and names the sources to match", () => {
    const data = answered(compose());

    expect(data.poolsSearched).toEqual({ v3: 2, v4: 1 });
    expect(data.sources).toEqual(["uniswap-v3-subgraph", "uniswap-v4-subgraph", "ethereum-rpc"]);
  });

  /* A deployment without a v4 subgraph still has an answer, and says what it lacks. */
  it("answers from the v3 net alone when the v4 list could not be read", () => {
    const data = answered(compose({ v4Candidates: unavailable() }));

    expect(data.poolsSearched).toEqual({ v3: 2, v4: null });
    expect(data.sources).toEqual(["uniswap-v3-subgraph", "ethereum-rpc"]);
    expect(data.pools.every((entry) => entry.pool.protocolVersion === "v3")).toBe(true);
  });

  it("answers from the v4 net alone when the v3 list could not be read", () => {
    const data = answered(
      compose({
        v3Candidates: unavailable(),
        balances: balances([{ address: NATIVE, amount: "1" }]),
      }),
    );

    expect(data.poolsSearched).toEqual({ v3: null, v4: 1 });
    expect(data.holdings[0]?.token.symbol).toBe("ETH");
  });

  it("refuses when neither list could be read, with the v3 list's own reason", () => {
    const result = compose({ v3Candidates: unavailable(), v4Candidates: unavailable() });

    expect(result.status === "unavailable" && result.notice).toBe("market-data-not-configured");
  });

  it("refuses when the balances could not be read, rather than reporting an empty wallet", () => {
    const result = compose({
      balances: { status: "unavailable", reason: "rate-limited", notice: "chain-data-rate-limited" },
    });

    expect(result.status === "unavailable" && result.notice).toBe("chain-data-rate-limited");
  });

  /* An ether balance with no v4 list has no verified identity to be shown under. */
  it("drops an ether balance when no list can name it", () => {
    const data = answered(
      compose({
        v4Candidates: unavailable(),
        balances: balances([{ address: NATIVE, amount: "1" }, { address: USDC.address, amount: "1" }]),
      }),
    );

    expect(data.holdings.map((holding) => holding.token.symbol)).toEqual(["USDC"]);
  });

  it("drops a balance for a currency in neither list", () => {
    const data = answered(compose({ balances: balances([{ address: `0x${"9".repeat(40)}`, amount: "1" }]) }));

    expect(data.holdings).toEqual([]);
    expect(data.pools).toEqual([]);
  });

  it("carries the count of currencies checked, for the page to state", () => {
    expect(answered(compose({ balances: balances([], 177) })).tokensChecked).toBe(177);
  });
});

/*
 * The chain, read after the fact for the v4 pools a page will show. The
 * candidate list carries every fee unread; these two are how the shown pools
 * get theirs.
 */
describe("displayedV4Pools", () => {
  const entry = (id: string, heldSides: "both" | "token0" | "token1", hookAddress: string | null = null) => ({
    pool: v4Pool(id, hookAddress),
    heldSides,
  });
  const holdingsWith = (pools: ReturnType<typeof entry>[]) =>
    ({ ...answered(compose()), pools }) as ReturnType<typeof answered>;

  it("names every pool held on both sides, and the one-sided ones up to the display cut", () => {
    const both = [entry(`0x${"01".repeat(32)}`, "both"), entry(`0x${"02".repeat(32)}`, "both")];
    const one = Array.from({ length: 15 }, (_u, index) => entry(`0x${(index + 16).toString(16).padStart(64, "0")}`, "token0"));
    const shown = displayedV4Pools(holdingsWith([...both, ...one]));

    expect(shown.map((pool) => pool.id)).toEqual([...both, ...one.slice(0, 12)].map((e) => e.pool.id));
  });

  it("leaves v3 pools out, which the chain is not asked about here", () => {
    const shown = displayedV4Pools(answered(compose()));

    expect(shown.every((pool) => pool.protocolVersion === "v4")).toBe(true);
    expect(shown.map((pool) => pool.id)).toEqual([V4_A]);
  });
});

describe("withV4ChainReadings", () => {
  const cut = (ppm: number) => ({ zeroForOnePpm: ppm, oneForZeroPpm: ppm });

  it("settles a hookless pool's fee from its state", () => {
    const applied = withV4ChainReadings(answered(compose()), new Map([[V4_A, { key: null, fees: { lpFeePpm: 500, protocolFee: cut(125) } }]]));

    const pool = applied?.pools.find((entry) => entry.pool.id === V4_A)?.pool;
    expect(pool?.protocolVersion === "v4" && pool.fee).toEqual({ kind: "static", feePpm: 500 });
    expect(pool?.protocolVersion === "v4" && pool.protocolFee).toEqual(cut(125));
  });

  it("leaves a pool the chain answered nothing for as it was", () => {
    const before = answered(compose());

    expect(withV4ChainReadings(before, new Map())).toEqual(before);
  });

  /* A reading that contradicts the indexer's record drops the pool, as it would from any list. */
  it("drops a pool whose key is not its own", () => {
    const key = { currency0: ETH.address, currency1: USDC.address, fee: 500, tickSpacing: 60, hooks: `0x${"0".repeat(40)}` };
    const applied = withV4ChainReadings(answered(compose()), new Map([[V4_A, { key, fees: null }]]));

    expect(applied?.pools.some((entry) => entry.pool.id === V4_A)).toBe(false);
  });

  it("keeps the v3 pools untouched", () => {
    const before = answered(compose());
    const applied = withV4ChainReadings(before, new Map([[V4_A, { key: null, fees: { lpFeePpm: 500, protocolFee: cut(0) } }]]));

    expect(applied?.pools.filter((entry) => entry.pool.protocolVersion === "v3")).toEqual(
      before.pools.filter((entry) => entry.pool.protocolVersion === "v3"),
    );
  });
});
