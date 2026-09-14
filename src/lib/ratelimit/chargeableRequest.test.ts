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
