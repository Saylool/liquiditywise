import { describe, expect, it } from "vitest";

import { spendsUpstreamQuota } from "./chargeableRequest";

const POOL_ADDRESS = `0x${"a".repeat(40)}`;

const query = (search: string) => new URLSearchParams(search);

describe("spendsUpstreamQuota", () => {
  it("charges an analysis", () => {
    expect(spendsUpstreamQuota(query(`address=${POOL_ADDRESS}`))).toBe(true);
  });

  /*
   * A search spends a query like an analysis does, and it is the cheaper of the
   * two to send in a loop: a box that takes ordinary words is a larger
   * invitation to do that than one that took a 40-character address.
   */
  it.each([
    ["a pair", "q=weth+usdc"],
    ["one term", "q=weth"],
    ["a pair written with a slash", "q=WETH%2FUSDC"],
  ])("charges a search for %s", (_label, search) => {
    expect(spendsUpstreamQuota(query(search))).toBe(true);
  });

  it.each([
    ["nothing asked", ""],
    ["an unrelated parameter", "locale=tr"],
    ["a malformed address", "address=0xnope"],
    ["an empty address", "address="],
    ["an empty search", "q="],
    ["a search term that is too short", "q=a"],
    ["a search term made of something else", "q=%24weth"],
  ])("charges nothing for %s", (_label, search) => {
    expect(spendsUpstreamQuota(query(search))).toBe(false);
  });

  /*
   * An address in the search box is answered with a redirect to the canonical
   * form, and that request is charged when it arrives. Charging both would bill
   * one visitor twice for one analysis.
   */
  it("charges an address in the search box once, when the redirect lands", () => {
    expect(spendsUpstreamQuota(query(`q=${POOL_ADDRESS}`))).toBe(false);
    expect(spendsUpstreamQuota(query(`address=${POOL_ADDRESS}`))).toBe(true);
  });

  /*
   * On the pool page the address parameter is the canonical one and decides on
   * its own. The page given both renders the analysis, or refuses the address,
   * and never runs the search — so a valid `q` beside a broken address must not
   * make the request chargeable for a search that will not happen.
   */
  it("lets the address parameter decide on the pool page when both arrive", () => {
    expect(spendsUpstreamQuota(query(`address=0xnope&q=weth+usdc`), "/pool")).toBe(false);
    expect(spendsUpstreamQuota(query(`address=&q=weth+usdc`), "/pool")).toBe(false);
    expect(spendsUpstreamQuota(query(`address=${POOL_ADDRESS}&q=weth+usdc`), "/pool")).toBe(true);
    expect(spendsUpstreamQuota(query(`q=weth+usdc`), "/pool")).toBe(true);
  });
});

/*
 * The finding this rule was rewritten for: one rule for every page, returning
 * on the first parameter it found, let a malformed `address` decide a request
 * to a page that never reads one — uncharged, while the page read its `id` or
 * its `q` all the same.
 */
describe("a parameter the page does not read", () => {
  const POOL_ID = `0x${"ab".repeat(32)}`;

  it.each([
    ["the v4 page, given a malformed address beside its id", "/v4", `address=0xnope&id=${POOL_ID}`],
    ["the v4 page, given an empty address beside its id", "/v4", `address=&id=${POOL_ID}`],
    ["the v4 page, given a v3 pool's address beside its id", "/v4", `id=${POOL_ID}&address=${POOL_ADDRESS}`],
    ["the pair page, given a malformed address beside its pair", "/pair", "address=0xnope&q=WETH%2FUSDC"],
    ["the pair page, given a malformed id beside its pair", "/pair", "id=nope&q=WETH%2FUSDC"],
    ["the holdings page, given a malformed id beside its address", "/holdings", `id=nope&address=${POOL_ADDRESS}`],
    ["the comparison, given a junk search beside its address", "/compare", `q=%24&address=${POOL_ADDRESS}`],
  ])("never lets it waive the charge on %s", (_label, page, search) => {
    expect(spendsUpstreamQuota(query(search), page)).toBe(true);
  });

  /* And never makes one either: what a page does not read, it does not spend. */
  it.each([
    ["the v4 page, given only an address", "/v4", `address=${POOL_ADDRESS}`],
    ["the v4 page, given only a search", "/v4", "q=weth+usdc"],
    ["the pair page, given only an address", "/pair", `address=${POOL_ADDRESS}`],
    ["the holdings page, given only a pool id", "/holdings", `id=${POOL_ID}`],
  ])("charges nothing for it alone on %s", (_label, page, search) => {
    expect(spendsUpstreamQuota(query(search), page)).toBe(false);
  });

  /*
   * A page refuses a repeated parameter rather than pick a value, but the rule
   * is wider than the page and never narrower: a good value anywhere among
   * the repeats is charged, so no order of repeats can sneak one through.
   */
  it("charges a repeated parameter when any of its values would be read", () => {
    expect(spendsUpstreamQuota(query(`id=nope&id=${POOL_ID}`), "/v4")).toBe(true);
    expect(spendsUpstreamQuota(query(`address=0xnope&address=${POOL_ADDRESS}`), "/holdings")).toBe(true);
    expect(spendsUpstreamQuota(query("q=a&q=weth"), "/pair")).toBe(true);
  });

  /*
   * A page with no rule of its own — or no page named at all — is charged
   * when any parameter a pool page reads would have been read: every one is
   * tried, and a broken one never hides a good one beside it.
   */
  it("tries every parameter on a page with no rule of its own", () => {
    expect(spendsUpstreamQuota(query(`address=0xnope&id=${POOL_ID}`))).toBe(true);
    expect(spendsUpstreamQuota(query("address=0xnope&q=weth+usdc"))).toBe(true);
    expect(spendsUpstreamQuota(query(`id=nope&address=${POOL_ADDRESS}`), "/")).toBe(true);
    expect(spendsUpstreamQuota(query("address=0xnope&id=nope&q=a"), "/hooks")).toBe(false);
  });
});

/*
 * The card a shared pool link unfurls into: one pool read like the page it
 * stands for, so charged like it, by the reader the route itself uses.
 */
describe("a pool's link card", () => {
  const CARD = "/og/pool";
  const POOL_ID = `0x${"ab".repeat(32)}`;

  it("is counted for a pool the route would read", () => {
    expect(spendsUpstreamQuota(query(`protocol=v3&id=${POOL_ADDRESS}`), CARD)).toBe(true);
    expect(spendsUpstreamQuota(query(`protocol=v4&id=${POOL_ID}&chain=unichain`), CARD)).toBe(true);
    expect(spendsUpstreamQuota(query(`protocol=v3&id=${POOL_ADDRESS}&address=0xnope`), CARD)).toBe(true);
  });

  it("is not counted for anything the route answers with the site's own card, asking nothing", () => {
    for (const search of [
      "",
      `id=${POOL_ADDRESS}`,
      `protocol=v3&id=nope`,
      `protocol=v4&id=${POOL_ADDRESS}`,
      `protocol=v3&id=${POOL_ADDRESS}&chain=unichain`,
      `protocol=v3&id=${POOL_ADDRESS}&chain=solana`,
      `protocol=v3&protocol=v3&id=${POOL_ADDRESS}`,
      `protocol=v3&id=${POOL_ADDRESS}&id=${POOL_ADDRESS}`,
    ]) {
      expect(spendsUpstreamQuota(query(search), CARD), search).toBe(false);
    }
  });
});

/*
 * The v4 analysis page, which addresses a pool by a 32-byte PoolId rather than
 * by a contract address, and spends the same three upstream queries.
 */
describe("a v4 pool id", () => {
  const POOL_ID = `0x${"ab".repeat(32)}`;

  it("is counted", () => {
    expect(spendsUpstreamQuota(new URLSearchParams({ id: POOL_ID }))).toBe(true);
  });

  it("is counted whatever its case, since the page lower-cases it", () => {
    expect(
      spendsUpstreamQuota(new URLSearchParams({ id: `0x${"AB".repeat(32)}` })),
    ).toBe(true);
  });

  /* A malformed id is answered without a single upstream call. */
  it("is not counted when it is not a pool id", () => {
    for (const id of ["", "0x", POOL_ID.slice(0, -1), `${POOL_ID}00`, "not-an-id"]) {
      expect(spendsUpstreamQuota(new URLSearchParams({ id }))).toBe(false);
    }
  });

  /* An address is not a PoolId, and the v4 page refuses it before reading. */
  it("is not counted when an address arrives under the v4 parameter", () => {
    expect(
      spendsUpstreamQuota(new URLSearchParams({ id: `0x${"a".repeat(40)}` })),
    ).toBe(false);
  });
});

/*
 * A v4 id typed into the search box is answered with a redirect to `/v4?id=`,
 * and that request is counted when it lands — the same rule as an address.
 */
describe("a v4 pool id in the search box", () => {
  it("is not counted, because the redirect it earns is", () => {
    expect(spendsUpstreamQuota(new URLSearchParams({ q: `0x${"e5".repeat(32)}` }))).toBe(false);
  });
});

/*
 * The share card names a position by its token id, a decimal, and reads the
 * chain for it: charged on that page alone, and only when the route would
 * read anything.
 */
describe("a position's share card", () => {
  const SHARE = "/api/share/position";

  it("is counted on its own page, for a well-formed position on a chain whose positions are kept", () => {
    expect(spendsUpstreamQuota(new URLSearchParams({ id: "998651" }), SHARE)).toBe(true);
    expect(spendsUpstreamQuota(new URLSearchParams({ chain: "base", id: "12345", lang: "tr" }), SHARE)).toBe(true);
  });

  it("is not counted for an address the route refuses before reading", () => {
    for (const search of ["", "id=0x12", "id=-1", "id=1&id=2", "chain=solana&id=1", "chain=celo&id=1", `address=${POOL_ADDRESS}`]) {
      expect(spendsUpstreamQuota(query(search), SHARE), search).toBe(false);
    }
  });

  /* A decimal id names no pool anywhere else, and the rule for every other page is unchanged. */
  it("leaves every other page's rule as it was", () => {
    expect(spendsUpstreamQuota(new URLSearchParams({ id: "998651" }), "/v4")).toBe(false);
    expect(spendsUpstreamQuota(new URLSearchParams({ id: "998651" }))).toBe(false);
    expect(spendsUpstreamQuota(query(`address=${POOL_ADDRESS}`), "/pool")).toBe(true);
  });
});
