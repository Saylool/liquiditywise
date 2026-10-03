import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/*
 * The pipeline replaced by the real one run on fixtures, so what each route
 * answers is checked end to end without a network: the address read, the pool
 * asked for, the figures kept, the card or the JSON written.
 */
const pipeline = vi.hoisted(() => ({
  asked: [] as unknown[][],
  answer: "read" as "read" | "unavailable" | "throws",
  hook: null as string | null,
}));
vi.mock("@/lib/advisor/getPoolRangeAnalysis", async () => {
  const { fixtureAnalysis } = await import("@/lib/testing/poolAnalysisFixture");
  return {
    getPoolRangeAnalysis: async (protocol: "v3" | "v4", poolId: string, parameters: unknown, ...rest: unknown[]) => {
      /* The deposit and a pool already read are not asked about: the card passes neither of its own. */
      pipeline.asked.push([protocol, poolId, parameters, rest[2]]);
      if (pipeline.answer === "throws") throw new Error("https://secret-rpc.example/key-123 timed out");
      if (pipeline.answer === "unavailable") {
        return { status: "unavailable", step: "pool", reason: "not-found", notice: "pool-not-found" };
      }
      return { status: "success", data: fixtureAnalysis(protocol, pipeline.hook) };
    },
  };
});

import { GET as card } from "./route";
import { GET as data } from "../../api/embed/pool/route";
import { forgetPoolEmbeds } from "@/lib/embed/readPoolEmbed";
import { PoolEmbedSchema } from "@/lib/embed/poolEmbed";
import { SWAP_HOOK, V3_POOL_ID, V4_POOL_ID } from "@/lib/testing/poolAnalysisFixture";

const get = (path: string) => new NextRequest(`http://localhost${path}`);

beforeEach(() => {
  pipeline.asked = [];
  pipeline.answer = "read";
  pipeline.hook = null;
  forgetPoolEmbeds();
});

describe("the embedded card's route", () => {
  it("reads the pool it names for the default horizon and width, on the chain it names", async () => {
    const response = await card(get(`/embed/pool?chain=base&address=${V3_POOL_ID}`));

    expect(response.status).toBe(200);
    expect(pipeline.asked).toEqual([["v3", V3_POOL_ID, { horizonDays: 30, standardDeviationMultiplier: 1 }, 8453]]);
    expect(await response.text()).toContain("USDC / WETH");
  });

  it("reads a pool once for every card and every reader, until its figures run out", async () => {
    await card(get(`/embed/pool?address=${V3_POOL_ID}`));
    await card(get(`/embed/pool?address=${V3_POOL_ID}&lang=tr`));
    await data(get(`/api/embed/pool?address=${V3_POOL_ID}`));

    expect(pipeline.asked).toHaveLength(1);
  });

  it("asks nothing for an address that names no pool, and says so on a card", async () => {
    const response = await card(get(`/embed/pool?address=nope&lang=de`));

    expect(response.status).toBe(400);
    expect(pipeline.asked).toEqual([]);
    expect(await response.text()).toContain("Diese Karte nennt keinen Pool");
  });

  it("shows a pool that could not be read as a short card, keeps nothing, and asks again", async () => {
    pipeline.answer = "unavailable";
    const response = await card(get(`/embed/pool?address=${V3_POOL_ID}`));
    await card(get(`/embed/pool?address=${V3_POOL_ID}`));

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("This pool could not be read just now.");
    expect(pipeline.asked).toHaveLength(2);
  });

  /* What a thrown error carries can include a keyed URL: none of it reaches the card. */
  it("shows the same short card when the read throws, and nothing of what it threw", async () => {
    pipeline.answer = "throws";
    const response = await card(get(`/embed/pool?address=${V3_POOL_ID}`));
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(html).toContain("could not be read just now");
    expect(html).not.toContain("secret-rpc");
    expect(html).not.toContain("timed out");
  });

  it("carries the hook note for a v4 pool whose hook may change what a swap costs", async () => {
    pipeline.hook = SWAP_HOOK;
    const html = await (await card(get(`/embed/pool?chain=unichain&id=${V4_POOL_ID}`))).text();

    expect(pipeline.asked[0]?.[0]).toBe("v4");
    expect(html).toContain("hook: may change what a swap costs");
  });
});

describe("the JSON route", () => {
  it("answers the figures, readable from any site", async () => {
    const response = await data(get(`/api/embed/pool?chain=unichain&id=${V4_POOL_ID}`));
    const body = PoolEmbedSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toContain("s-maxage=");
    expect(body).toMatchObject({ protocol: "v4", chain: { slug: "unichain" }, hookMayAlterSwaps: false });
    expect(body.poolUrl).toBe(`https://liquiditywise.com/v4?chain=unichain&id=${V4_POOL_ID}&days=30&sigma=1`);
  });

  it("answers bad input and an unreadable pool in JSON, never with a stack trace", async () => {
    const bad = await data(get(`/api/embed/pool?id=${V3_POOL_ID}`));
    pipeline.answer = "throws";
    const unreadable = await data(get(`/api/embed/pool?address=${V3_POOL_ID}`));

    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: "not-a-pool" });
    expect(unreadable.status).toBe(503);
    const text = await unreadable.text();
    expect(JSON.parse(text)).toMatchObject({ error: "unreadable" });
    expect(text).not.toContain("secret-rpc");
  });
});
