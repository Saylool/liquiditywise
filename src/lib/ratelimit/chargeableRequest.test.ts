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
   * The address parameter is the canonical one and decides on its own. A page
   * given both renders the analysis and never runs the search, so a valid `q`
   * beside a broken address must not make the request chargeable for a search
   * that will not happen.
   */
  it("lets the address parameter decide when both arrive", () => {
    expect(spendsUpstreamQuota(query(`address=0xnope&q=weth+usdc`))).toBe(false);
    expect(spendsUpstreamQuota(query(`address=${POOL_ADDRESS}&q=weth+usdc`))).toBe(true);
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
