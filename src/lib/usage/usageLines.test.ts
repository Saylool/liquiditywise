import { describe, expect, it } from "vitest";

import { looksLikeBot, parseUsageLine, spendLine, visitFrom, visitLine } from "./usageLines";

const ADDRESS = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
const POOL_ID = `0x${"ab".repeat(32)}`;
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

const visit = (path: string, headers: Record<string, string> = { "user-agent": BROWSER }) =>
  visitFrom(new URL(`https://liquiditywise.com${path}`), new Headers(headers), "tr", "served");

describe("what a visit line records", () => {
  it("names the pool a v3 or v4 page was opened for, in lower case", () => {
    expect(visit(`/pool?address=${ADDRESS}`)?.pool).toBe(`v3:${ADDRESS.toLowerCase()}`);
    expect(visit(`/v4?id=${POOL_ID.toUpperCase().replace("0X", "0x")}`)?.pool).toBe(`v4:${POOL_ID}`);
    expect(visit(`/v4?chain=arbitrum&id=${POOL_ID}`)?.pool).toBe(`v4@arbitrum:${POOL_ID}`);
    expect(visit(`/v4?chain=solana&id=${POOL_ID}`)?.pool).toBeNull();
  });

  /*
   * The line this module exists to get right. The holdings page is opened
   * with a reader's own wallet in the query, and the site promises nothing
   * about them is kept unless they ask for alerts.
   */
  it("never records the address on the holdings page", () => {
    const line = visitLine(visit(`/holdings?address=${ADDRESS}`) ?? (null as never));

    expect(line).toBe("[visit] page=/holdings pool=- locale=tr bot=0 outcome=served chain=ethereum");
    expect(line.toLowerCase()).not.toContain(ADDRESS.toLowerCase().slice(2));
  });

  it("records the chain a page that reads one was opened on, and none for a page that reads none", () => {
    expect(visit("/most-traded?chain=base")?.chain).toBe("base");
    expect(visit(`/v4?chain=arbitrum&id=${POOL_ID}`)?.chain).toBe("arbitrum");
    expect(visit("/compare?chain=solana")?.chain).toBe("unknown");
    expect(visit("/pool?q=weth")?.chain).toBe("ethereum");
    expect(visit("/hooks?chain=base")?.chain).toBe("base");
    expect(visit("/smart-money?chain=polygon")?.chain).toBe("polygon");
    expect(visit("/weekly?chain=base")?.chain).toBe("base");
    expect(visit("/weekly")?.chain).toBe("ethereum");
    expect(visit("/weekly")?.page).toBe("/weekly");
    expect(visit("/most-traded?chain=bnb")?.chain).toBe("bnb");
    expect(visit("/hooks?chain=avalanche")?.chain).toBe("avalanche");
    expect(visit("/pool?chain=celo&q=celo")?.chain).toBe("celo");
    expect(visit("/most-traded?chain=bsc")?.chain).toBe("unknown");
    expect(visit("/smart-money")?.page).toBe("/smart-money");
    expect(visit("/learn?chain=base")?.chain).toBeNull();
    expect(visitLine(visit("/") ?? (null as never))).toBe("[visit] page=/ pool=- locale=tr bot=0 outcome=served");
  });

  it("reads the chain back from a line, and a line written before it was kept as naming none", () => {
    const parsed = parseUsageLine("[visit] page=/holdings pool=- locale=tr bot=0 outcome=served chain=base");
    const old = parseUsageLine("[visit] page=/holdings pool=- locale=tr bot=0 outcome=served");
    const odd = parseUsageLine("[visit] page=/holdings pool=- locale=tr bot=0 outcome=served chain=BASE;rm");

    expect(parsed?.kind === "visit" && parsed.visit.chain).toBe("base");
    expect(old?.kind === "visit" && old.visit.chain).toBeNull();
    expect(odd?.kind === "visit" && odd.visit.chain).toBeNull();
  });

  it("records that a search happened, never what was searched for", () => {
    const line = visitLine(visit("/pool?q=my%20secret%20words") ?? (null as never));

    expect(line).toContain("pool=search");
    expect(line).not.toContain("secret");
  });

  it("counts the pair page as a search across every network, naming no one network", () => {
    const line = visitLine(visit("/pair?q=secret%2Fwords") ?? (null as never));

    expect(line).toBe("[visit] page=/pair pool=search locale=tr bot=0 outcome=served");
    expect(visit("/pair")?.pool).toBeNull();
    expect(parseUsageLine(line)).toMatchObject({ kind: "visit", visit: { page: "/pair", pool: "search", chain: null } });
  });

  it("records no browser string and no address of the person", () => {
    const line = visitLine(
      visit("/", { "user-agent": BROWSER, "cf-connecting-ip": "203.0.113.7", "x-real-ip": "203.0.113.7" }) ?? (null as never),
    );

    expect(line).not.toMatch(/203\.0\.113|Mozilla|Safari/);
  });

  it("ignores what is not a page, and a query that is not a pool", () => {
    expect(visit("/api/health")).toBeNull();
    expect(visit("/_next/static/chunk.js")).toBeNull();
    expect(visit("/pool?address=not-an-address")?.pool).toBeNull();
    expect(visit(`/v4?id=${ADDRESS}`)?.pool).toBeNull();
  });

  /* The embeddable card and its JSON name a pool as the pool pages do, under one path. */
  it("names the pool an embedded card or its JSON was loaded for, and the chain", () => {
    expect(visit(`/embed/pool?address=${ADDRESS}`)?.pool).toBe(`v3:${ADDRESS.toLowerCase()}`);
    expect(visit(`/embed/pool?chain=base&id=${POOL_ID}`)?.pool).toBe(`v4@base:${POOL_ID}`);
    expect(visit(`/api/embed/pool?chain=unichain&id=${POOL_ID}`)).toMatchObject({
      page: "/api/embed/pool",
      pool: `v4@unichain:${POOL_ID}`,
      chain: "unichain",
    });
    expect(visit("/embed/pool?address=nope")).toMatchObject({ pool: null, chain: "ethereum" });
    const line = visitLine(visit(`/embed/pool?address=${ADDRESS}`) ?? (null as never));
    expect(parseUsageLine(`2026-10-05T08:00:00+0000 host app[1]: ${line}`)).toMatchObject({
      kind: "visit",
      visit: { page: "/embed/pool", pool: `v3:${ADDRESS.toLowerCase()}` },
    });
  });

  it("does not count a page the browser loaded ahead of a click", () => {
    expect(visit("/pool", { "user-agent": BROWSER, purpose: "prefetch" })).toBeNull();
    expect(visit("/pool", { "user-agent": BROWSER, "sec-purpose": "prefetch;prerender" })).toBeNull();
  });

  it("tells crawlers and scripts from people, and counts no-name callers as bots", () => {
    expect(looksLikeBot(BROWSER)).toBe(false);
    for (const agent of ["Googlebot/2.1", "curl/8.5.0", "python-requests/2.31", "UptimeRobot/2.0", "", null]) {
      expect(looksLikeBot(agent)).toBe(true);
    }
  });
});

describe("reading the journal back", () => {
  it("reads back every visit exactly as it was written, with the journal's day and minute", () => {
    const written = visit(`/pool?address=${ADDRESS}`) ?? (null as never);

    expect(parseUsageLine(`2026-09-24T06:43:44+0000 srv npm[1]: ${visitLine(written)}`)).toEqual({
      kind: "visit",
      at: "2026-09-24",
      minute: "2026-09-24T06:43",
      visit: written,
    });
    expect(parseUsageLine(visitLine(written))).toMatchObject({ at: null, minute: null });
  });

  it("reads back what an explanation spent, with a pair that cannot break the line", () => {
    const line = spendLine({ model: "gpt-5.6-luna", inputTokens: 1834, outputTokens: 612, pool: "v3:0xabc", pair: "US DC/W=ETH" });

    expect(line).toBe("[interpretation] spent model=gpt-5.6-luna in=1834 out=612 pool=v3:0xabc pair=USDC/WETH");
    expect(parseUsageLine(line)).toEqual({
      kind: "spend",
      at: null,
      spend: { model: "gpt-5.6-luna", inputTokens: 1834, outputTokens: 612, pool: "v3:0xabc", pair: "USDC/WETH" },
    });
  });

  it("counts an answer the checks turned down", () => {
    expect(parseUsageLine("[interpretation] answer rejected — a digit")?.kind).toBe("rejected");
  });

  it.each([
    "[v3-pool-search] 33 of 38 pools dormant",
    "[visit] page=/admin pool=- locale=en bot=0 outcome=served",
    "[visit] page=/pool pool=- locale=en bot=2 outcome=served",
    "[visit] page=/pool pool=- locale=en bot=0 outcome=maybe",
    "[visit] page=/pool pool=- bot=0 outcome=served",
    "[interpretation] spent model=x in=many out=1",
    "[interpretation] spent in=1 out=1",
  ])("ignores a line that is not one of ours: %s", (line) => {
    expect(parseUsageLine(line)).toBeNull();
  });
});

describe("the comparison page", () => {
  it("is counted, with the pool it was opened from", () => {
    expect(visit(`/compare?address=${ADDRESS}`)?.pool).toBe(`v3:${ADDRESS.toLowerCase()}`);
  });
});
