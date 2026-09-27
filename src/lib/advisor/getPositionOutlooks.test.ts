import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const asked = vi.hoisted(() => ({ reads: [] as unknown[][], failing: new Set<string>() }));
vi.mock("../uniswap/getEthereumDailyPriceHistory", () => ({
  getEthereumDailyPriceHistory: async (protocol: string, id: string, chainId: number) => {
    asked.reads.push([protocol, id, chainId]);
    if (asked.failing.has(id)) return { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" };
    return { status: "success", data: { pool: { protocolVersion: protocol, chainId, id }, points: [] } };
  },
}));
vi.mock("./positionOutlook", () => ({
  positionOutlook: ({ position }: { position: { tokenId: string } }) => ({ days: 30, inside: Number(position.tokenId), outside: 0, crossed: 0, suggested: null }),
}));

import type { Position } from "../../schemas";
import { getPositionOutlooks, OUTLOOK_POOL_LIMIT, outlookKey } from "./getPositionOutlooks";

const position = (tokenId: string, id: string, protocolVersion: "v3" | "v4" = "v3", chainId = 1) =>
  ({ tokenId, pool: { protocolVersion, chainId, id } }) as unknown as Position;
const PARAMETERS = { horizonDays: 30, standardDeviationMultiplier: 1 };

beforeEach(() => {
  asked.reads = [];
  asked.failing = new Set();
});

describe("the outlooks of an address's positions", () => {
  it("reads each pool's history once, on its own chain, and keys each position by protocol and token", async () => {
    const outlooks = await getPositionOutlooks(
      [position("1", "0xAA"), position("2", "0xaa"), position("3", "0xbb", "v4", 42161)],
      PARAMETERS,
    );

    expect(asked.reads).toEqual([
      ["v3", "0xAA", 1],
      ["v4", "0xbb", 42161],
    ]);
    expect([...outlooks.keys()]).toEqual(["v3-1", "v3-2", "v4-3"]);
    expect(outlookKey(position("9", "0xcc", "v4"))).toBe("v4-9");
  });

  it("gives no outlook to a position whose pool's history could not be read", async () => {
    asked.failing.add("0xbb");
    const outlooks = await getPositionOutlooks([position("1", "0xaa"), position("2", "0xbb")], PARAMETERS);

    expect([...outlooks.keys()]).toEqual(["v3-1"]);
  });

  it("reads no more than a dozen pools for one address", async () => {
    const many = Array.from({ length: OUTLOOK_POOL_LIMIT + 3 }, (_, index) => position(String(index), `0x${index}`));
    const outlooks = await getPositionOutlooks(many, PARAMETERS);

    expect(asked.reads).toHaveLength(OUTLOOK_POOL_LIMIT);
    expect(outlooks.size).toBe(OUTLOOK_POOL_LIMIT);
  });
});
