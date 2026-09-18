import { describe, expect, it, vi } from "vitest";

import {
  fetchEthereumV4PositionIds,
  MAX_V4_POSITION_IDS,
  V4_POSITION_IDS_QUERY,
} from "./ethereumV4PositionIds";
import type { FetchLike } from "./v3SubgraphTransport";

const API_KEY = "test-graph-key-must-never-leak";
const SUBGRAPH_ID = "TestV4SubgraphId";
const OWNER = "0xee67b29f25a44a1cf65d3500afcf29af25033a67";

const body = (positions: readonly { tokenId: string }[], hasIndexingErrors = false) => ({
  data: { positions, _meta: { hasIndexingErrors } },
});

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status });

const run = (
  overrides: Partial<Parameters<typeof fetchEthereumV4PositionIds>[0]> = {},
  payload: unknown = body([{ tokenId: "408162" }, { tokenId: "408160" }]),
) =>
  fetchEthereumV4PositionIds({
    owner: OWNER,
    apiKey: API_KEY,
    subgraphId: SUBGRAPH_ID,
    fetchImpl: vi.fn<FetchLike>(async () => jsonResponse(payload)),
    timeoutMs: 1_000,
    ...overrides,
  });

const succeed = async (...args: Parameters<typeof run>) => {
  const result = await run(...args);
  if (result.status === "unavailable") throw new Error(`expected ids: ${result.notice}`);
  return result.data;
};

describe("fetchEthereumV4PositionIds", () => {
  it("reads the ids the indexer attributes to the address", async () => {
    expect(await succeed()).toEqual(["408162", "408160"]);
  });

  it("asks only for the ids, and only for this owner", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse(body([{ tokenId: "408162" }])),
    );
    await run({ fetchImpl });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const sent = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };

    expect(sent.query).toBe(V4_POSITION_IDS_QUERY);
    expect(sent.variables).toEqual({ owner: OWNER, limit: MAX_V4_POSITION_IDS });
    /*
     * The `Position` entity carries no liquidity, no ticks and no pool — only a
     * token id and an owner — so there is nothing else here worth asking for.
     * Everything a position *is* comes from the chain.
     */
    expect(sent.query).not.toContain("liquidity");
    expect(sent.query).not.toContain("tickLower");
  });

  it("lower-cases the owner before asking", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(body([])));
    await run({ owner: OWNER.toUpperCase().replace("0X", "0x"), fetchImpl });

    const [, init] = fetchImpl.mock.calls[0] ?? [];

    expect(JSON.parse(String(init?.body)).variables.owner).toBe(OWNER);
  });

  /*
   * An id that is not a whole number cannot be turned into calldata, and a
   * duplicate would have the chain count one position twice.
   */
  it("drops an id that is not one, and asks about each only once", async () => {
    expect(
      await succeed(
        {},
        body([{ tokenId: "7" }, { tokenId: "0x7" }, { tokenId: "7" }, { tokenId: "" }]),
      ),
    ).toEqual(["7"]);
  });

  it("answers with nothing for an address the indexer knows no positions for", async () => {
    expect(await succeed({}, body([]))).toEqual([]);
  });

  it.each([
    ["an owner that is not an address", { owner: "0xnope" }, "invalid-input"],
    ["no api key", { apiKey: "  " }, "configuration-error"],
    ["no subgraph", { subgraphId: undefined }, "configuration-error"],
  ])("refuses %s before anything goes out", async (_label, overrides, reason) => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse(body([])));
    const result = await run({ ...overrides, fetchImpl });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe(reason);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["an answer of the wrong shape", { data: { positions: [{ id: "7" }] } }],
    ["an answer with no data at all", { errors: [{ message: "no" }] }],
    ["an answer reporting query errors", { data: { positions: [] }, errors: [{ message: "no" }] }],
  ])("refuses %s", async (_label, payload) => {
    const result = await run({}, payload);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe("market-data-malformed");
  });

  /*
   * An indexer that says it is behind is not a shorter list, it is a list that
   * might be missing somebody's position — and this is the read where a missing
   * one matters most.
   */
  it("refuses an answer the indexer says it could not index", async () => {
    const result = await run({}, body([{ tokenId: "7" }], true));

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe("market-data-indexing-errors");
  });

  it("stops at a ceiling wide enough for the busiest address measured", () => {
    expect(MAX_V4_POSITION_IDS).toBeGreaterThanOrEqual(104);
  });
});
