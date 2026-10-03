import { describe, expect, it } from "vitest";

import { ETHEREUM } from "../chains/chains";
import { fixtureAnalysis, V3_POOL_ID } from "../testing/poolAnalysisFixture";
import {
  EMBED_TTL_SECONDS,
  embedCardResponse,
  embedDataResponse,
  FIGURES_CACHE,
  NOT_A_POOL_CACHE,
  UNREADABLE_CACHE,
} from "./embedResponses";
import { PoolEmbedSchema, poolEmbedFigures } from "./poolEmbed";

const figures = poolEmbedFigures(fixtureAnalysis(), { protocol: "v3", chain: ETHEREUM, poolId: V3_POOL_ID });
const POOL_URL = `https://liquiditywise.com/pool?address=${V3_POOL_ID}&days=30&sigma=1`;

describe("the card's answer", () => {
  it("is a page, kept in front as long as its figures are kept here", async () => {
    const response = embedCardResponse({ kind: "pool", figures }, "en");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe(FIGURES_CACHE);
    expect(FIGURES_CACHE).toContain(`s-maxage=${EMBED_TTL_SECONDS}`);
    expect(await response.text()).toContain("USDC / WETH");
  });

  it("is a card, not an error page, when there is nothing to show — kept less long", async () => {
    const unreadable = embedCardResponse({ kind: "unreadable", poolUrl: POOL_URL }, "en");
    const nothing = embedCardResponse({ kind: "not-a-pool" }, "en");

    expect([unreadable.status, nothing.status]).toEqual([503, 400]);
    expect(unreadable.headers.get("cache-control")).toBe(UNREADABLE_CACHE);
    expect(nothing.headers.get("cache-control")).toBe(NOT_A_POOL_CACHE);
    expect(await unreadable.text()).toContain("could not be read just now");
  });

  /* Who may frame it is said once, by the proxy; a header here would be ignored behind next.config's. */
  it("leaves framing to the proxy", () => {
    const response = embedCardResponse({ kind: "pool", figures }, "en");

    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("x-frame-options")).toBeNull();
  });
});

describe("the JSON answer", () => {
  it("is the figures, readable from any site, with the same cache", async () => {
    const response = embedDataResponse({ kind: "pool", figures }, "en");
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe(FIGURES_CACHE);
    expect(PoolEmbedSchema.parse(body)).toMatchObject({
      protocol: "v3",
      pool: V3_POOL_ID,
      price: { base: "WETH", quote: "USDC" },
      parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
      analysedAt: figures.analysedAt,
      poolUrl: POOL_URL,
    });
    expect(typeof (body as { price: { current: unknown } }).price.current).toBe("number");
  });

  it("answers a failure in JSON too, with a code, the disclaimer and the CORS header", async () => {
    const unreadable = embedDataResponse({ kind: "unreadable", poolUrl: POOL_URL }, "en");
    const nothing = embedDataResponse({ kind: "not-a-pool" }, "es");

    expect(unreadable.status).toBe(503);
    expect(await unreadable.json()).toMatchObject({ error: "unreadable", poolUrl: POOL_URL, disclaimer: expect.stringContaining("not financial advice") });
    expect(nothing.status).toBe(400);
    expect(await nothing.json()).toMatchObject({ error: "not-a-pool", disclaimer: expect.stringContaining("no es asesoramiento financiero") });
    expect(unreadable.headers.get("access-control-allow-origin")).toBe("*");
    expect(nothing.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("never sends figures that do not hold their shape", async () => {
    const broken = { ...figures, range: { ...figures.range, lower: Number.NaN } };
    const response = embedDataResponse({ kind: "pool", figures: broken }, "en");

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "unreadable" });
    expect(response.headers.get("cache-control")).toBe(UNREADABLE_CACHE);
  });
});
