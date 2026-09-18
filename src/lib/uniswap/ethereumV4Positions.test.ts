import { describe, expect, it } from "vitest";

import { collectV4Positions, fetchEthereumV4Positions } from "./ethereumV4Positions";
import type { Aggregate3Result } from "./multicall3";
import { rpcEndpoint } from "./testing/multicall3Endpoint";

const OWNER = "0xee67b29f25a44a1cf65d3500afcf29af25033a67";
const STRANGER = "0xcccabbaef2244e8692bac1678e8db661834d3389";
const V4_POOL = "0xa86fb6fbddb6d2e85e39b9894ff33c799cddbc4051ede12bc8399b8c3d51670a";

/*
 * `getPoolAndPositionInfo(408162)` as mainnet answered it on 2026-09-18: the
 * ETH/HEI pool at a 70% fee and a spacing of 7000, full-range. The same fixture
 * the decoder is tested against, so the two cannot disagree about what a
 * position looks like.
 */
const INFO_ANSWER =
  "0x0000000000000000000000000000000000000000000000000000000000000000" +
  "000000000000000000000000f8f173e20e15f3b6cb686fb64724d370689de083" +
  "00000000000000000000000000000000000000000000000000000000000aae60" +
  "0000000000000000000000000000000000000000000000000000000000001b58" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "a86fb6fbddb6d2e85e39b9894ff33c799cddbc4051ede12bc80d7550f28ab000";

const ok = (data: string): Aggregate3Result => ({ success: true, data });
const reverted: Aggregate3Result = { success: false, data: "0x" };
const addressAnswer = (address: string) => ok(`0x${address.slice(2).padStart(64, "0")}`);
const liquidityAnswer = (value: bigint) => ok(`0x${value.toString(16).padStart(64, "0")}`);

/** The three answers one id produces, in the order they were asked. */
const answersFor = (
  owner = OWNER,
  liquidity = 28_519_709_909_040_362_220n,
  info = INFO_ANSWER,
): Aggregate3Result[] => [addressAnswer(owner), ok(info), liquidityAnswer(liquidity)];

describe("collectV4Positions", () => {
  it("reads a position the manager confirms is this address's", () => {
    const { open, read, closed } = collectV4Positions(OWNER, ["408162"], answersFor());

    expect(read).toBe(1);
    expect(closed).toBe(0);
    expect(open).toEqual([
      {
        tokenId: "408162",
        key: {
          currency0: "0x0000000000000000000000000000000000000000",
          currency1: "0xf8f173e20e15f3b6cb686fb64724d370689de083",
          fee: 700_000,
          tickSpacing: 7_000,
          hooks: "0x0000000000000000000000000000000000000000",
        },
        poolId: V4_POOL,
        tickLower: -882_000,
        tickUpper: 882_000,
        liquidity: "28519709909040362220",
      },
    ]);
  });

  it("pairs each set of three answers with the id at its own place", () => {
    const { open } = collectV4Positions(
      OWNER,
      ["41", "42"],
      [...answersFor(), ...answersFor()],
    );

    expect(open.map((position) => position.tokenId)).toEqual(["41", "42"]);
  });

  /* A token whose liquidity is gone is a receipt, not a position. */
  it("counts a closed one rather than listing it", () => {
    const { open, read, closed } = collectV4Positions(OWNER, ["1"], answersFor(OWNER, 0n));

    expect(open).toEqual([]);
    expect(read).toBe(1);
    expect(closed).toBe(1);
  });

  /*
   * The check that makes an indexer's list safe to use. A token the manager
   * attributes to somebody else was never this address's position, so it is not
   * counted as read either — counting it would describe a shortfall that is not
   * there.
   */
  it("drops a token the manager says somebody else owns, and does not count it", () => {
    expect(collectV4Positions(OWNER, ["1"], answersFor(STRANGER))).toEqual({
      open: [],
      read: 0,
      closed: 0,
    });
  });

  /* Unread is neither open nor closed, and an unreadable owner is unread. */
  it.each([
    ["the owner call reverted", [reverted, ok(INFO_ANSWER), liquidityAnswer(1n)]],
    ["the info call reverted", [addressAnswer(OWNER), reverted, liquidityAnswer(1n)]],
    ["the liquidity call reverted", [addressAnswer(OWNER), ok(INFO_ANSWER), reverted]],
    ["the owner does not decode", [ok("0xdead"), ok(INFO_ANSWER), liquidityAnswer(1n)]],
  ])("counts nothing when %s", (_label, results) => {
    expect(collectV4Positions(OWNER, ["1"], results)).toEqual({ open: [], read: 0, closed: 0 });
  });

  /*
   * An answer that does not describe a position is read — the manager did say
   * this address owns the token — but it is neither open nor closed, because
   * nobody knows which.
   */
  it("counts an id whose description does not decode as read and no more", () => {
    expect(collectV4Positions(OWNER, ["1"], answersFor(OWNER, 1n, "0xdead"))).toEqual({
      open: [],
      read: 1,
      closed: 0,
    });
  });

  it("leaves out an id with no answers at its place, and keeps the ones that have them", () => {
    const { open, read, closed } = collectV4Positions(OWNER, ["1", "2"], answersFor());

    expect(open.map((position) => position.tokenId)).toEqual(["1"]);
    expect(read).toBe(1);
    expect(closed).toBe(0);
  });
});

describe("fetchEthereumV4Positions", () => {
  const read = (overrides: Partial<Parameters<typeof fetchEthereumV4Positions>[0]> = {}) =>
    fetchEthereumV4Positions({
      owner: OWNER,
      tokenIds: ["408162"],
      rpcUrl: "https://node.example.invalid/key",
      fetchImpl: rpcEndpoint(),
      timeoutMs: 1_000,
      ...overrides,
    });

  it.each([
    ["an owner that is not an address", { owner: "0xnope" }],
    ["an owner nobody supplied", { owner: "" }],
  ])("refuses %s before anything goes out", async (_label, overrides) => {
    const result = await read(overrides);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("invalid-input");
  });

  it("reports a missing endpoint as a configuration problem", async () => {
    const result = await read({ rpcUrl: "  " });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe("chain-data-not-configured");
  });

  /*
   * The proof before the answers. The stub's node returns Multicall3's runtime
   * for every address, so the manager's own check fails — which is the point:
   * an address answering with code this application does not know is an address
   * whose answers mean nothing.
   *
   * The paths past this one cannot be reached from a stub, because getting past
   * it needs 23,877 bytes that hash to the manager's runtime. They are covered
   * instead by the pure function above, which is everything this reader does
   * with an answer, and by a live read against the real manager.
   */
  it("refuses a manager that answers with code it does not know", async () => {
    const result = await read();

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe("positions-manager-unverified");
  });
});
