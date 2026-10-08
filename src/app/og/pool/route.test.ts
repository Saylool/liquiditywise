import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/*
 * The card's read held open by the test, so the budget around the route can
 * be filled on purpose: what runs, what waits, and what is turned away
 * without anything being read for it. The drawing is the real one.
 */
const reads = vi.hoisted(() => ({ waiting: [] as (() => void)[], asked: 0 }));

vi.mock("@/lib/og/readPoolCard", () => ({
  readPoolCard: async () => {
    reads.asked += 1;
    await new Promise<void>((resolve) => reads.waiting.push(resolve));
    return { pair: "WETH / USDC", detail: "Uniswap v3 · 0.05% · Ethereum" };
  },
}));

import { POOL_CARDS_AT_ONCE, POOL_CARDS_WAITING } from "@/lib/og/poolCardBudget";
import { GET } from "./route";

const card = () => GET(new NextRequest(`http://localhost/og/pool?protocol=v3&id=0x${"ab".repeat(20)}`));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const releaseAll = async (pending: Promise<Response>[]) => {
  while (reads.waiting.length > 0 || reads.asked < pending.length) {
    reads.waiting.shift()?.();
    await settle();
  }
  return Promise.all(pending);
};

afterEach(() => {
  for (const release of reads.waiting.splice(0)) release();
  reads.asked = 0;
});

describe("the pool card's route", () => {
  it("draws the card whole, and lets a cache keep it a day", async () => {
    const pending = card();
    const [response] = await releaseAll([pending]);

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toBe("image/png");
    expect(response?.headers.get("cache-control")).toContain("max-age=86400");
    expect((await response?.arrayBuffer())?.byteLength).toBeGreaterThan(1000);
  }, 20_000);

  /*
   * Four drawn at once and sixteen in line; the next is turned away before
   * anything is read for it, told to come back shortly, and kept by no cache.
   * Once the work in hand is done, a card is drawn again.
   */
  it("turns a card away past its budget without reading anything, and draws again once there is room", async () => {
    const pending = Array.from({ length: POOL_CARDS_AT_ONCE + POOL_CARDS_WAITING }, () => card());
    await settle();
    expect(reads.asked).toBe(POOL_CARDS_AT_ONCE);

    const turnedAway = await card();
    expect(turnedAway.status).toBe(503);
    expect(Number(turnedAway.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(turnedAway.headers.get("cache-control")).toBe("no-store");
    expect(reads.asked).toBe(POOL_CARDS_AT_ONCE);

    const drawn = await releaseAll(pending);
    expect(drawn.map(({ status }) => status)).toEqual(drawn.map(() => 200));

    const again = card();
    const [answered] = await releaseAll([again]);
    expect(answered?.status).toBe(200);
  }, 60_000);
});
