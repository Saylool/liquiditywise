import { describe, expect, it } from "vitest";

import {
  fetchEthereumV3PositionHistories,
  HISTORY_PAGE,
  MAX_HISTORY_PAGES,
  readSnapshot,
  V3_POSITION_HISTORY_QUERY,
} from "./ethereumV3PositionSnapshots";
import type { FetchLike } from "./v3SubgraphTransport";

type Row = {
  id: string;
  position: { id: string };
  blockNumber: string;
  timestamp: string;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
};

/** One row as the positions subgraph sends it, every number a string. */
const row = (tokenId: string, block: number, overrides: Partial<Row> = {}): Row => ({
  id: `${tokenId}#${block}`,
  position: { id: tokenId },
  blockNumber: String(block),
  timestamp: String(1_714_557_600 + block),
  liquidity: "2204989653163776",
  depositedToken0: "5000.25",
  depositedToken1: "1.5",
  withdrawnToken0: "0",
  withdrawnToken1: "0",
  feeGrowthInside0LastX128: "3979518691523452388431907510082993",
  feeGrowthInside1LastX128: "1726981430484923575981082306417489046260583",
  ...overrides,
});

type Sent = { query: string; variables: { ids: string[]; from: string; limit: number } };

/**
 * A positions subgraph in miniature: it answers the history query as the
 * gateway does — the rows of the asked positions from the asked block on,
 * ordered by block, at most `limit` of them — and keeps what was asked.
 */
const subgraph = (rows: readonly Row[], answer?: (sent: Sent) => unknown) => {
  const sent: Sent[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    const body = JSON.parse(String(init.body)) as Sent;
    sent.push(body);
    const payload =
      answer?.(body) ?? {
        data: {
          positionSnapshots: rows
            .filter((entry) => body.variables.ids.includes(entry.position.id))
            .filter((entry) => BigInt(entry.blockNumber) >= BigInt(body.variables.from))
            .sort((left, right) => Number(BigInt(left.blockNumber) - BigInt(right.blockNumber)))
            .slice(0, body.variables.limit),
          _meta: { hasIndexingErrors: false },
        },
      };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  return { sent, source: { chainId: 1 as const, apiKey: "key", subgraphId: "positions", fetchImpl } };
};

const read = async (ids: readonly string[], rows: readonly Row[], answer?: (sent: Sent) => unknown) => {
  const { sent, source } = subgraph(rows, answer);
  const result = await fetchEthereumV3PositionHistories(ids, source);
  return { sent, result };
};

describe("reading one row", () => {
  it("takes every figure it needs, exactly, and dates it", () => {
    expect(readSnapshot(row("998651", 20_000_000, { withdrawnToken1: "0.25" }))).toEqual({
      blockNumber: 20_000_000n,
      at: new Date((1_714_557_600 + 20_000_000) * 1000).toISOString(),
      liquidity: 2_204_989_653_163_776n,
      deposited0: 5000.25,
      deposited1: 1.5,
      withdrawn0: 0,
      withdrawn1: 0.25,
      feeGrowthInside0: 3_979_518_691_523_452_388_431_907_510_082_993n,
      feeGrowthInside1: 1_726_981_430_484_923_575_981_082_306_417_489_046_260_583n,
    });
  });

  it("keeps a fee-growth snapshot just below 2^256, which a wrapped counter can be", () => {
    const top = ((1n << 256n) - 1n).toString();
    expect(readSnapshot(row("1", 1, { feeGrowthInside0LastX128: top }))?.feeGrowthInside0).toBe((1n << 256n) - 1n);
  });

  it.each([
    ["a fee-growth snapshot past a uint256", { feeGrowthInside1LastX128: (1n << 256n).toString() }],
    ["a liquidity past a uint128", { liquidity: (1n << 128n).toString() }],
    ["a negative liquidity", { liquidity: "-5" }],
    ["a block that is not a number", { blockNumber: "12a" }],
    ["a time that is not a number", { timestamp: "yesterday" }],
    ["a negative time", { timestamp: "-1" }],
    ["a negative deposit", { depositedToken0: "-1" }],
    ["a withdrawal that is not a decimal", { withdrawnToken1: "lots" }],
  ])("refuses %s", (_label, overrides) => {
    expect(readSnapshot(row("1", 1, overrides))).toBeNull();
  });
});

describe("reading the positions' histories", () => {
  it("asks once, from the first block, for the positions asked about and for no fee field", async () => {
    const { sent, result } = await read(["7", "8"], [row("7", 10), row("8", 11), row("7", 12)]);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.query).toBe(V3_POSITION_HISTORY_QUERY);
    expect(sent[0]?.variables).toEqual({ ids: ["7", "8"], from: "0", limit: HISTORY_PAGE });
    expect(sent[0]?.query).not.toContain("collectedFees");
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.snapshots.get("7")?.map(({ blockNumber }) => blockNumber)).toEqual([10n, 12n]);
    expect(result.data.snapshots.get("8")?.map(({ blockNumber }) => blockNumber)).toEqual([11n]);
    expect(result.data.unreadable).toEqual(new Set());
  });

  it("says which positions it asked about, including one with no rows", async () => {
    const { result } = await read(["7", "9"], [row("7", 10)]);

    expect(result.status === "success" && [...result.data.asked]).toEqual(["7", "9"]);
    expect(result.status === "success" && result.data.snapshots.has("9")).toBe(false);
  });

  it("asks nothing when there is nothing to ask about, and asks only about ids that are numbers", async () => {
    const none = await read([], []);
    expect(none.sent).toHaveLength(0);
    expect(none.result).toMatchObject({ status: "success" });

    const { sent } = await read(["7", "7", "0x7", ""], [row("7", 10)]);
    expect(sent[0]?.variables.ids).toEqual(["7"]);
  });

  /*
   * A page that ends part-way through one block — two positions changed by
   * the same transaction — must not lose the block's other row, and the next
   * page, which starts at that block again, must not count the first one twice.
   */
  it("pages from the last block reached, inclusive, and counts no row twice", async () => {
    const rows = Array.from({ length: HISTORY_PAGE + 500 }, (_unused, index) =>
      row(index % 2 === 0 ? "7" : "8", 100 + Math.floor(index / 2)),
    );
    const { sent, result } = await read(["7", "8"], rows);

    expect(sent).toHaveLength(2);
    /* The thousandth row, the second of block 599's pair, is where the first page stopped. */
    expect(sent[1]?.variables.from).toBe("599");
    expect(result.status === "success" && result.data.snapshots.get("7")).toHaveLength(750);
    expect(result.status === "success" && result.data.snapshots.get("8")).toHaveLength(750);
    const blocks = result.status === "success" ? (result.data.snapshots.get("8") ?? []).map(({ blockNumber }) => blockNumber) : [];
    expect(new Set(blocks).size).toBe(750);
  });

  it("pages again after a page that came back exactly full", async () => {
    const rows = Array.from({ length: HISTORY_PAGE }, (_unused, index) => row("7", index + 1));
    const { sent, result } = await read(["7"], rows);

    expect(sent).toHaveLength(2);
    expect(result.status === "success" && result.data.snapshots.get("7")).toHaveLength(HISTORY_PAGE);
    expect(result.status === "success" && result.data.unreadable.size).toBe(0);
  });

  /* Past the pages one read takes, any of them may have rows never read: all are reported unreadable. */
  it("reports every position unreadable when the history runs past the last page", async () => {
    const rows = Array.from({ length: HISTORY_PAGE * MAX_HISTORY_PAGES + 1 }, (_unused, index) =>
      row(index === 0 ? "8" : "7", index + 1),
    );
    const { sent, result } = await read(["7", "8"], rows);

    expect(sent).toHaveLength(MAX_HISTORY_PAGES);
    expect(result.status === "success" && result.data.unreadable).toEqual(new Set(["7", "8"]));
  });

  it("marks only the position whose row could not be read, and keeps reading", async () => {
    const { result } = await read(["7", "8"], [row("7", 10), row("8", 11, { liquidity: "-1" }), row("8", 12), row("7", 13)]);

    expect(result.status === "success" && result.data.unreadable).toEqual(new Set(["8"]));
    expect(result.status === "success" && result.data.snapshots.get("7")).toHaveLength(2);
  });

  it("ignores a row about a position it did not ask about", async () => {
    const { result } = await read(["7"], [], () => ({
      data: { positionSnapshots: [row("7", 10), row("99", 11, { liquidity: "-1" })], _meta: null },
    }));

    expect(result.status === "success" && [...result.data.snapshots.keys()]).toEqual(["7"]);
    expect(result.status === "success" && result.data.unreadable.size).toBe(0);
  });

  /*
   * The cursor is only sound in the order asked for. A source that ignored it
   * would put a block where the next page never looks.
   */
  it.each([
    ["rows out of block order", [row("7", 12), row("7", 10)]],
    ["a block that is not a number to page from", [row("7", 0, { blockNumber: "-1" })]],
  ])("fails whole on %s", async (_label, rows) => {
    const { result } = await read(["7"], [], () => ({ data: { positionSnapshots: rows, _meta: null } }));

    expect(result).toMatchObject({ status: "unavailable", notice: "market-data-malformed" });
  });

  it("fails whole on a row behind the cursor on a later page", async () => {
    const first = Array.from({ length: HISTORY_PAGE }, (_unused, index) => row("7", index + 1));
    const { result } = await read(["7"], [], (sent) => ({
      data: { positionSnapshots: sent.variables.from === "0" ? first : [row("7", 5)], _meta: null },
    }));

    expect(result).toMatchObject({ status: "unavailable", notice: "market-data-malformed" });
  });

  it.each([
    ["errors", { errors: [{ message: "bad indexers" }] }, "market-data-malformed"],
    ["no data", { data: null }, "market-data-malformed"],
    ["the wrong shape", { data: { positionSnapshots: [{ id: 7 }], _meta: null } }, "market-data-malformed"],
    ["indexing errors", { data: { positionSnapshots: [], _meta: { hasIndexingErrors: true } } }, "market-data-indexing-errors"],
  ])("fails whole on an answer with %s", async (_label, payload, notice) => {
    const { result } = await read(["7"], [], () => payload);

    expect(result).toMatchObject({ status: "unavailable", notice });
  });

  it("fails whole when a later page fails, rather than keeping the first", async () => {
    const first = Array.from({ length: HISTORY_PAGE }, (_unused, index) => row("7", index + 1));
    const { result } = await read(["7"], [], (sent) =>
      sent.variables.from === "0" ? { data: { positionSnapshots: first, _meta: null } } : { errors: [{ message: "timeout" }] },
    );

    expect(result).toMatchObject({ status: "unavailable" });
  });

  it("asks nothing without a key or a subgraph, and says it is not configured", async () => {
    const { sent, source } = subgraph([row("7", 1)]);

    expect(await fetchEthereumV3PositionHistories(["7"], { ...source, apiKey: " " })).toMatchObject({
      status: "unavailable",
      notice: "market-data-not-configured",
    });
    expect(await fetchEthereumV3PositionHistories(["7"], { ...source, subgraphId: undefined })).toMatchObject({
      status: "unavailable",
      notice: "market-data-not-configured",
    });
    expect(sent).toHaveLength(0);
  });
});
