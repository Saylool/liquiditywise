import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/*
 * The read replaced by fixtures, so what the route answers is checked end to
 * end without a network or a chain: the address read, the position asked
 * for, the card drawn or the JSON written, and what is kept.
 */
const chain = vi.hoisted(() => ({
  asked: [] as unknown[][],
  answer: "verified" as "verified" | "unverified" | "not-found" | "unavailable",
}));

const XOR = `0x${"4".repeat(40)}`;
const WETH = `0x${"c".repeat(40)}`;
const POOL = `0x${"7".repeat(40)}`;

vi.mock("@/lib/advisor/getPositionRecord", () => ({
  getPositionRecord: async (tokenId: string, chainId: number) => {
    chain.asked.push([tokenId, chainId]);
    if (chain.answer === "unavailable") return { status: "unavailable" };
    if (chain.answer === "not-found") return { status: "not-found" };
    return {
      status: "found",
      described: {
        position: {
          tokenId,
          pool: {
            protocolVersion: "v3",
            chainId,
            id: POOL,
            feePpm: 10_000,
            token0: { chainId, address: XOR, symbol: "XOR", decimals: 18 },
            token1: { chainId, address: WETH, symbol: "WETH", decimals: 18 },
          },
          tickLower: -414_400,
          tickUpper: 0,
          lowerPrice: 1e-18,
          upperPrice: 1,
          liquidity: "38349616863029655014582929927279522",
          currentTick: -200_000,
          inRange: true,
          uncollected: null,
        },
        record:
          chain.answer === "unverified"
            ? { status: "unverified", reason: "liquidity-differs" }
            : {
                status: "verified",
                record: {
                  openedAt: "2024-05-01T10:00:00.000Z",
                  deposited: { token0: 100, token1: 10 },
                  withdrawn: { token0: 0, token1: 1 },
                  now: { token0: 80, token1: 15 },
                  fees: { token0: 3, token1: 1 },
                  price: 0.5,
                },
              },
      },
    };
  },
}));

import { GET } from "./route";
import { forgetPositionCards } from "@/lib/share/readPositionCard";

const get = (path: string) => GET(new NextRequest(`http://localhost${path}`));

/** The eight bytes every PNG begins with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const isPng = async (response: Response): Promise<boolean> => {
  const bytes = new Uint8Array(await response.arrayBuffer());
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
};

beforeEach(() => {
  chain.asked = [];
  chain.answer = "verified";
  forgetPositionCards();
});

describe("the share card's route", () => {
  it("draws a 1200 by 630 PNG of the position it names, on the chain it names, kept five minutes", async () => {
    const response = await get("/api/share/position?chain=base&id=998651&lang=tr");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    expect(chain.asked).toEqual([["998651", 8453]]);
    expect(await isPng(response)).toBe(true);
  }, 30_000);

  it("reads a position once for every language and every reader, until the reading runs out", async () => {
    await get("/api/share/position?id=998651");
    await get("/api/share/position?id=998651&lang=de");
    await get("/api/share/position?id=998651&lang=zh-Hant");

    expect(chain.asked).toHaveLength(1);
  }, 30_000);

  it("still draws a card for a record that could not be verified, with no figure on it", async () => {
    chain.answer = "unverified";
    const response = await get("/api/share/position?id=998651");

    expect(response.status).toBe(200);
    expect(await isPng(response)).toBe(true);
  }, 30_000);

  it("answers an address that names no position in JSON, asking nothing", async () => {
    for (const path of [
      "/api/share/position",
      "/api/share/position?id=0x12",
      "/api/share/position?id=-1",
      "/api/share/position?id=1&id=2",
      "/api/share/position?chain=solana&id=1",
      /* A chain whose positions are not kept: no record is verified there, so no card is drawn. */
      "/api/share/position?chain=celo&id=1",
      "/api/share/position?chain=unichain&id=1",
    ]) {
      const response = await get(path);
      expect(response.status, path).toBe(400);
      expect(response.headers.get("content-type"), path).toContain("application/json");
      expect(response.headers.get("cache-control"), path).toBe("public, max-age=3600, s-maxage=3600");
      expect(await response.json(), path).toEqual({ error: "not-a-position" });
    }
    expect(chain.asked).toEqual([]);
  });

  it("answers an id the chain holds no open position under with a 404 in JSON, and keeps that briefly", async () => {
    chain.answer = "not-found";
    const response = await get("/api/share/position?id=7");
    await get("/api/share/position?id=7");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "no-such-position" });
    expect(response.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    expect(chain.asked).toHaveLength(1);
  });

  it("answers a position that could not be read with a 503 in JSON, keeps nothing, and asks again", async () => {
    chain.answer = "unavailable";
    const response = await get("/api/share/position?id=998651");
    await get("/api/share/position?id=998651");

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unreadable" });
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=60");
    expect(chain.asked).toHaveLength(2);
  });

  it("sets no CORS header: the card is an image, not an API another site's script reads", async () => {
    const response = await get("/api/share/position?id=998651");

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  }, 30_000);
});
