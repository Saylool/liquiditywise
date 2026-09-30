import { describe, expect, it } from "vitest";

import {
  fetchEthereumV3InRangePositions,
  fetchEthereumV3LastChanges,
  SNAPSHOT_BATCH,
  V3_IN_RANGE_POSITIONS_QUERY,
  V3_LAST_CHANGES_QUERY,
  V3_POOL_STATE_QUERY,
} from "./ethereumV3InRangePositions";
import type { FetchLike } from "./v3SubgraphTransport";

const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const token = (id: string, symbol: string, decimals: string, derivedETH: string) => ({ id, symbol, decimals, derivedETH });
const STATE = {
  data: {
    pool: {
      id: POOL,
      feeTier: "500",
      tick: "198080",
      token0: token(`0x${"A".repeat(40)}`, "USDC", "6", "0.0004"),
      token1: token(`0x${"B".repeat(40)}`, "WETH", "18", "1"),
    },
    bundles: [{ ethPriceUSD: "2500" }],
    _meta: { hasIndexingErrors: false },
  },
};
const position = (id: string, lower: string, upper: string, liquidity = "1000") => ({
  id,
  liquidity,
  tickLower: { tickIdx: lower },
  tickUpper: { tickIdx: upper },
});

type Sent = { query: string; variables: Record<string, unknown> };

/** Answers each query by its text, and keeps what was asked. */
const source = (answers: { state?: unknown; positions?: unknown; snapshots?: (ids: string[]) => unknown }) => {
  const sent: Sent[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    const body = JSON.parse(String(init.body)) as Sent;
    sent.push(body);
    const payload =
      body.query === V3_POOL_STATE_QUERY
        ? answers.state
        : body.query === V3_IN_RANGE_POSITIONS_QUERY
          ? answers.positions
          : answers.snapshots?.(body.variables.ids as string[]);
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  return { sent, source: { chainId: 1 as const, apiKey: "key", subgraphId: "sub", fetchImpl } };
};

describe("a pool's positions in range", () => {
  it("asks for the positions around the pool's own tick, deepest first, and keeps only those in range", async () => {
    const { sent, source: s } = source({
      state: STATE,
      positions: {
        data: {
          positions: [
            position("11", "197480", "198680"),
            position("12", "198080", "198200"),
            position("13", "197000", "198080"),
            position("14", "bad", "198200"),
            position("15", "198200", "198100"),
            position("16", "197000", "198200", "-5"),
          ],
        },
      },
    });
    const result = await fetchEthereumV3InRangePositions(POOL.toUpperCase().replace("0X", "0x"), s);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(sent[1]?.variables).toEqual({ pool: POOL, tick: "198080", limit: 1000 });
    expect(sent[1]?.query).toContain("orderBy: liquidity");
    expect(sent[1]?.query).toContain("orderDirection: desc");
    /* The lower edge is inside, the upper is not: 13 ends at the price and so is out. */
    expect(result.data.positions.map(({ tokenId }) => tokenId)).toEqual(["11", "12"]);
    expect(result.data.positions[0]).toEqual({ tokenId: "11", liquidity: "1000", tickLower: 197480, tickUpper: 198680 });
    expect(result.data.tick).toBe(198080);
    expect(result.data.pool.token0.address).toBe(`0x${"a".repeat(40)}`);
    expect(result.data.usdPerToken0).toBeCloseTo(1, 12);
    expect(result.data.usdPerToken1).toBe(2500);
  });

  it("leaves a token's dollar price unknown where the source has no price for it", async () => {
    const noEth = { data: { ...STATE.data, bundles: [] } };
    const { source: s } = source({ state: noEth, positions: { data: { positions: [] } } });
    const result = await fetchEthereumV3InRangePositions(POOL, s);

    expect(result.status === "success" && [result.data.usdPerToken0, result.data.usdPerToken1]).toEqual([null, null]);
  });

  it("says a pool the source does not know is not found, and asks nothing more", async () => {
    const { sent, source: s } = source({ state: { data: { ...STATE.data, pool: null } } });

    expect(await fetchEthereumV3InRangePositions(POOL, s)).toMatchObject({ status: "unavailable", reason: "not-found" });
    expect(sent).toHaveLength(1);
  });

  it("refuses an answer with errors or indexing errors in it, and a malformed address before asking", async () => {
    const withErrors = source({ state: { ...STATE, errors: [{ message: "bad indexers" }] } });
    const indexing = source({ state: { data: { ...STATE.data, _meta: { hasIndexingErrors: true } } } });

    expect(await fetchEthereumV3InRangePositions(POOL, withErrors.source)).toMatchObject({ status: "unavailable" });
    expect(await fetchEthereumV3InRangePositions(POOL, indexing.source)).toMatchObject({
      status: "unavailable",
      notice: "market-data-indexing-errors",
    });
    const idle = source({});
    expect(await fetchEthereumV3InRangePositions("0xnope", idle.source)).toMatchObject({ reason: "invalid-input" });
    expect(idle.sent).toHaveLength(0);
  });

  it("reports no configuration rather than asking without a key", async () => {
    const { sent, source: s } = source({ state: STATE });

    expect(await fetchEthereumV3InRangePositions(POOL, { ...s, apiKey: " " })).toMatchObject({
      reason: "configuration-error",
    });
    expect(sent).toHaveLength(0);
  });
});

describe("when each position last changed", () => {
  it("is its newest snapshot, asked a few positions at a time", async () => {
    const ids = Array.from({ length: SNAPSHOT_BATCH + 3 }, (_unused, index) => String(index + 1));
    const { sent, source: s } = source({
      snapshots: (asked) => ({
        data: {
          positionSnapshots: asked.flatMap((id) => [
            { position: { id }, timestamp: String(2_000 + Number(id)) },
            { position: { id }, timestamp: String(1_000 + Number(id)) },
          ]),
        },
      }),
    });
    const result = await fetchEthereumV3LastChanges(ids, s);

    expect(sent.map(({ variables }) => (variables.ids as string[]).length)).toEqual([SNAPSHOT_BATCH, 3]);
    expect(sent[0]?.query).toBe(V3_LAST_CHANGES_QUERY);
    expect(result.status === "success" && [...result.data.entries()].slice(0, 2)).toEqual([
      ["1", 2_001],
      ["2", 2_002],
    ]);
    expect(result.status === "success" && result.data.size).toBe(ids.length);
  });

  it("leaves out a position with no snapshot rather than dating it, and fails whole on a refused batch", async () => {
    const partial = source({ snapshots: () => ({ data: { positionSnapshots: [{ position: { id: "1" }, timestamp: "5" }] } }) });
    const refused = source({ snapshots: () => ({ errors: [{ message: "bad indexers" }] }) });

    const kept = await fetchEthereumV3LastChanges(["1", "2"], partial.source);
    expect(kept.status === "success" && [...kept.data.keys()]).toEqual(["1"]);
    expect(await fetchEthereumV3LastChanges(["1"], refused.source)).toMatchObject({ status: "unavailable" });
  });
});
