import { describe, expect, it } from "vitest";

import type {
  DataResult,
  PoolCandidateList,
  V4PoolCandidateList,
} from "../../schemas";
import type { AddressBalances } from "../uniswap/ethereumBalances";
import { composeAddressHoldings } from "./addressHoldings";

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
  data: { pools: [v4Pool(V4_A)], fetchedAt: FETCHED_AT, source: "uniswap-v4-subgraph" },
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
