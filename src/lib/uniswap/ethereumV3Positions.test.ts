import { describe, expect, it } from "vitest";

import type { Aggregate3Result } from "./multicall3";
import {
  collectPositions,
  collectTokenIds,
  fetchEthereumV3Positions,
  MAX_POSITIONS_READ,
} from "./ethereumV3Positions";
import { rpcEndpoint } from "./testing/multicall3Endpoint";

/*
 * `positions(1112391)` as mainnet answered it — XOR/WETH at the 1% tier, ticks
 * -414400 to 0. The same fixture the decoder is tested against, so the two
 * cannot disagree about what a position looks like.
 */
const OPEN_ANSWER =
  "0x" +
  "0".repeat(64).repeat(2) +
  "00000000000000000000000040fd72257597aa14c7231a7b1aaa29fce868f677" +
  "000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" +
  "0000000000000000000000000000000000000000000000000000000000002710" +
  "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9ad40" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "00000000000000000000000000000000000762c8372fef4e5ff537a1b61593a2" +
  "0".repeat(64).repeat(4);

/** The same position after it has been closed: every figure but the liquidity. */
const CLOSED_ANSWER = `${OPEN_ANSWER.slice(0, 2 + 7 * 64)}${"0".repeat(64)}${OPEN_ANSWER.slice(2 + 8 * 64)}`;

const ok = (data: string): Aggregate3Result => ({ success: true, data });
const reverted: Aggregate3Result = { success: false, data: "0x" };
const idAnswer = (value: number) => ok(`0x${value.toString(16).padStart(64, "0")}`);

describe("collectTokenIds", () => {
  it("keeps the ids that answered, in the order they were asked", () => {
    expect(collectTokenIds([idAnswer(7), idAnswer(9)])).toEqual(["7", "9"]);
  });

  /*
   * An id can be burnt between two round trips. Dropping the hole is what keeps
   * the next sweep's answers lined up with the ids that produced them.
   */
  it("drops one that reverted rather than shifting the rest", () => {
    expect(collectTokenIds([idAnswer(7), reverted, idAnswer(9)])).toEqual(["7", "9"]);
  });

  it("drops one that does not decode", () => {
    expect(collectTokenIds([ok("0xabc")])).toEqual([]);
  });
});

describe("collectPositions", () => {
  it("keeps the ones with liquidity and counts the ones without", () => {
    const { open, closed } = collectPositions(
      ["1", "2", "3"],
      [ok(OPEN_ANSWER), ok(CLOSED_ANSWER), ok(OPEN_ANSWER)],
    );

    expect(open.map((position) => position.tokenId)).toEqual(["1", "3"]);
    expect(closed).toBe(1);
  });

  it("pairs each answer with the id at its own place", () => {
    const { open } = collectPositions(["41", "42"], [ok(OPEN_ANSWER), ok(OPEN_ANSWER)]);

    expect(open.map((position) => position.tokenId)).toEqual(["41", "42"]);
    expect(open[0]?.tickLower).toBe(-414_400);
    expect(open[0]?.feePpm).toBe(10_000);
  });

  /*
   * Unread is neither open nor closed. Counting it as either would be a figure
   * about a position nobody read.
   */
  it.each([
    ["one that reverted", ["1"], [reverted]],
    ["one that does not decode", ["1"], [ok("0xdead")]],
    ["an answer with no id at its place", [], [ok(OPEN_ANSWER)]],
  ])("counts %s as neither", (_label, ids, results) => {
    expect(collectPositions(ids, results)).toEqual({ open: [], closed: 0 });
  });
});

describe("fetchEthereumV3Positions", () => {
  const read = (overrides: Partial<Parameters<typeof fetchEthereumV3Positions>[0]> = {}) =>
    fetchEthereumV3Positions({
      owner: "0xb6f1f0c31689f4c06df33c88da2a8b9c7c0fedbd",
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
   * it needs bytes that hash to the manager's runtime. They are covered instead
   * by the two pure functions above, which is everything this reader does with
   * an answer, and by a live read against three real addresses.
   */
  it("refuses a manager that answers with code it does not know", async () => {
    const result = await read();

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe("positions-manager-unverified");
  });

  it("reads no further than its ceiling", () => {
    expect(MAX_POSITIONS_READ).toBeGreaterThan(12);
  });
});
