import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fetchEthereumV3Position } from "./ethereumV3Position";
import { MULTICALL3_ADDRESS } from "./multicall3";
import { MULTICALL3_RUNTIME_CODE } from "./multicall3RuntimeCode";
import { rpcEndpoint } from "./testing/multicall3Endpoint";
import { FACTORY_SELECTOR, POSITIONS_SELECTOR, V3_POSITION_MANAGERS } from "./v3PositionManager";

/*
 * `positions(1112391)` as mainnet answered it — XOR/WETH at the 1% tier, ticks
 * -414400 to 0 — the fixture the sweep and the decoder are tested against.
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

const FACTORY = "0x33128a8fc17869897dce68ed026d694621f6fdfd";
const FACTORY_ANSWER = `0x${FACTORY.slice(2).padStart(64, "0")}`;

/*
 * The Base manager's real runtime, read from the chain on 2026-09-26: the
 * only way past the proof without a live node, so every read here is on Base.
 */
const BASE_RUNTIME = readFileSync(join(__dirname, "testing", "base-v3-position-manager.hex"), "utf8").trim();
const BASE_MANAGER = V3_POSITION_MANAGERS[8453].address;

const read = ({
  tokenId = "1112391",
  chainId = 8453 as 1 | 8453,
  answer = OPEN_ANSWER as string | null,
  code = (address: string) => (address.toLowerCase() === MULTICALL3_ADDRESS ? MULTICALL3_RUNTIME_CODE : BASE_RUNTIME),
  rpcUrl = "https://node.example.invalid/key",
  asked = [] as { to: string; data: string }[],
} = {}) =>
  fetchEthereumV3Position({
    tokenId,
    chainId,
    rpcUrl,
    fetchImpl: rpcEndpoint({
      code,
      call: (question) => {
        asked.push(question);
        if (question.data.startsWith(FACTORY_SELECTOR)) return { success: true, data: FACTORY_ANSWER };
        return answer === null ? { success: false, data: "0x" } : { success: true, data: answer };
      },
    }),
    timeoutMs: 1_000,
  });

describe("fetchEthereumV3Position", () => {
  it("asks that chain's manager what one id is and where its pools come from, in one call", async () => {
    const asked: { to: string; data: string }[] = [];
    const result = await read({ asked });

    expect(asked.map(({ to }) => to.toLowerCase())).toEqual([BASE_MANAGER, BASE_MANAGER]);
    expect(asked[0]?.data.startsWith(POSITIONS_SELECTOR)).toBe(true);
    expect(asked[1]?.data).toBe(FACTORY_SELECTOR);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.factory).toBe(FACTORY);
    expect(result.data.position).toMatchObject({ tokenId: "1112391", feePpm: 10_000, tickLower: -414_400, tickUpper: 0 });
  });

  /* Not there is an answer: neither a burnt id nor a closed one is a failed read. */
  it.each([
    ["an id the manager reverts on", null],
    ["a position that has been closed", CLOSED_ANSWER],
    ["an answer that is not a position", "0xdead"],
  ])("answers no position for %s", async (_label, answer) => {
    expect(await read({ answer })).toEqual({ status: "success", data: { factory: FACTORY, position: null } });
  });

  it.each([
    ["an id that is not a number", "nope"],
    ["an id nobody supplied", ""],
    ["a hex id", "0x12"],
  ])("refuses %s before anything goes out", async (_label, tokenId) => {
    const asked: { to: string; data: string }[] = [];
    const result = await read({ tokenId, asked });

    expect(asked).toEqual([]);
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

  /* The proof before the answers: Base's code where mainnet's manager should be means nothing it says is believed. */
  it("refuses a manager that answers with code it does not know", async () => {
    const result = await read({ chainId: 1 });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe("positions-manager-unverified");
  });

  it("fails whole when the factory does not decode, since no pool could be derived", async () => {
    const result = await fetchEthereumV3Position({
      tokenId: "1112391",
      chainId: 8453,
      rpcUrl: "https://node.example.invalid/key",
      fetchImpl: rpcEndpoint({
        code: (address) => (address.toLowerCase() === MULTICALL3_ADDRESS ? MULTICALL3_RUNTIME_CODE : BASE_RUNTIME),
        call: (question) => (question.data === FACTORY_SELECTOR ? { success: false, data: "0x" } : { success: true, data: OPEN_ANSWER }),
      }),
      timeoutMs: 1_000,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).toBe("positions-unreadable");
  });
});
