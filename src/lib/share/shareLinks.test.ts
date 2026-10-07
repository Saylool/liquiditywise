import { describe, expect, it } from "vitest";

import { chainBySlug, ETHEREUM } from "../chains/chains";
import { SHARE_PAGES } from "../site/indexing";
import { readShareRequest } from "./shareRequest";
import { holdingsUrl, postOnXUrl, SHARE_CARD_PATH, shareCardUrl, X_INTENT } from "./shareLinks";

const BASE = chainBySlug("base")!;
const OWNER = `0x${"b".repeat(40)}`;

describe("the share row's links", () => {
  it("name the card on the site's own host, the chain unsaid on mainnet and the language unsaid in English", () => {
    expect(shareCardUrl(ETHEREUM, "998651", "en")).toBe("https://liquiditywise.com/api/share/position?id=998651");
    expect(shareCardUrl(BASE, "12345", "tr")).toBe("https://liquiditywise.com/api/share/position?chain=base&id=12345&lang=tr");
  });

  /* The address the row offers is the one the route reads: the two cannot drift. */
  it("name a card the route reads back as the same position", () => {
    for (const [chain, tokenId] of [
      [ETHEREUM, "998651"],
      [BASE, "12345"],
    ] as const) {
      const url = new URL(shareCardUrl(chain, tokenId, "zh-Hant"));
      expect(url.pathname).toBe(SHARE_CARD_PATH);
      expect(readShareRequest(url.searchParams)).toEqual({ chain, chainId: chain.id, tokenId });
    }
    expect(SHARE_CARD_PATH).toBe(SHARE_PAGES[0]);
  });

  it("name the holdings page the record was read on, with its chain", () => {
    expect(holdingsUrl(OWNER, ETHEREUM)).toBe(`https://liquiditywise.com/holdings?address=${OWNER}`);
    expect(holdingsUrl(OWNER, BASE)).toBe(`https://liquiditywise.com/holdings?chain=base&address=${OWNER}`);
  });

  it("open a post on X with the text written and the card attached, each escaped for the address", () => {
    const url = new URL(postOnXUrl("XOR / WETH: -3 XOR & more. Measured, not advice.", shareCardUrl(BASE, "12345", "tr")));

    expect(`${url.origin}${url.pathname}`).toBe(X_INTENT);
    expect(url.searchParams.get("text")).toBe("XOR / WETH: -3 XOR & more. Measured, not advice.");
    expect(url.searchParams.get("url")).toBe("https://liquiditywise.com/api/share/position?chain=base&id=12345&lang=tr");
    expect([...url.searchParams.keys()]).toEqual(["text", "url"]);
  });
});
