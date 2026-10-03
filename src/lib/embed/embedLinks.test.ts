import { describe, expect, it } from "vitest";

import { chainBySlug, ETHEREUM } from "../chains/chains";
import { embedCardUrl, embedDataUrl, embedFrameHeight, embedSnippet } from "./embedLinks";
import { readEmbedLocale, readEmbedRequest, type EmbedRequest } from "./embedRequest";

const ADDRESS = `0x${"ab".repeat(20)}`;
const ID = `0x${"cd".repeat(32)}`;
const V3: EmbedRequest = { protocol: "v3", chain: ETHEREUM, poolId: ADDRESS };
const V4: EmbedRequest = { protocol: "v4", chain: chainBySlug("base")!, poolId: ID };

describe("a card's addresses", () => {
  it("name the chain only off mainnet, and the language only when it is not English", () => {
    expect(embedCardUrl(V3, "en")).toBe(`https://liquiditywise.com/embed/pool?address=${ADDRESS}`);
    expect(embedCardUrl(V4, "tr")).toBe(`https://liquiditywise.com/embed/pool?chain=base&id=${ID}&lang=tr`);
    expect(embedDataUrl(V4)).toBe(`https://liquiditywise.com/api/embed/pool?chain=base&id=${ID}`);
  });

  it("are read back as the pool and the language they were written for", () => {
    for (const request of [V3, V4]) {
      const written = new URL(embedCardUrl(request, "zh-Hant")).searchParams;
      expect(readEmbedRequest(written)).toEqual(request);
      expect(readEmbedLocale(written)).toBe("zh-Hant");
      expect(readEmbedRequest(new URL(embedDataUrl(request)).searchParams)).toEqual(request);
    }
  });
});

describe("the snippet to paste", () => {
  it("is a lazy, borderless frame of the card, at the card's size", () => {
    expect(embedSnippet(V3, "USDC / WETH", false, "en")).toBe(
      `<iframe src="https://liquiditywise.com/embed/pool?address=${ADDRESS}" title="USDC / WETH on LiquidityWise" width="360" height="200" style="border:0;max-width:100%" loading="lazy"></iframe>`,
    );
  });

  it("is taller where the card carries the hook note", () => {
    expect(embedFrameHeight(true)).toBeGreaterThan(embedFrameHeight(false));
    expect(embedSnippet(V4, "ETH / USDC", true, "en")).toContain(`height="${embedFrameHeight(true)}"`);
  });

  it("escapes what came from a token contract, and the ampersands in its address", () => {
    const snippet = embedSnippet(V4, '"><script>alert(1)</script>', false, "de");

    expect(snippet).not.toContain("<script>");
    expect(snippet).toContain("&quot;&gt;&lt;script&gt;");
    expect(snippet).toContain("chain=base&amp;id=");
  });
});
