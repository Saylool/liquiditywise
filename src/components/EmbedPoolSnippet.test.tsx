import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { chainBySlug, ETHEREUM } from "../lib/chains/chains";
import { EmbedPoolSnippet } from "./EmbedPoolSnippet";

const ADDRESS = `0x${"ab".repeat(20)}`;
const ID = `0x${"cd".repeat(32)}`;

const render = (props: Partial<Parameters<typeof EmbedPoolSnippet>[0]> = {}) =>
  renderToStaticMarkup(
    <EmbedPoolSnippet protocol="v3" poolId={ADDRESS} chain={ETHEREUM} pair="USDC / WETH" hookMayAlterSwaps={false} locale="en" {...props} />,
  );

describe("the offer to embed a pool", () => {
  const markup = render();

  it("is a folded disclosure that needs no script", () => {
    expect(markup.startsWith("<details")).toBe(true);
    expect(markup).toContain("<summary");
    expect(markup).toContain("Embed this pool");
    expect(markup).not.toContain("<script");
  });

  it("holds the frame to paste in a read-only box, escaped as text", () => {
    expect(markup).toMatch(/<textarea readonly=""/i);
    expect(markup).toContain(
      `&lt;iframe src=&quot;https://liquiditywise.com/embed/pool?address=${ADDRESS}&quot; title=&quot;USDC / WETH on LiquidityWise&quot;`,
    );
  });

  it("names the JSON address, as text rather than a link", () => {
    expect(markup).toContain(`https://liquiditywise.com/api/embed/pool?address=${ADDRESS}`);
    expect(markup).not.toContain(`href="https://liquiditywise.com/api/`);
  });

  /* The one link in it: everything a developer would ask next, in the reader's language. */
  it("leads to the documentation, and nowhere else", () => {
    const links = [...markup.matchAll(/<a [^>]*href="([^"]+)"/g)].map(([, href]) => href);

    expect(links).toEqual(["/en/developers"]);
    expect(markup).toContain("The card and its JSON, documented in full");
    expect([...render({ locale: "tr" }).matchAll(/<a [^>]*href="([^"]+)"/g)].map(([, href]) => href)).toEqual([
      "/tr/developers",
    ]);
  });

  it("offers a v4 pool's frame by its id, on its chain, taller where the hook note goes", () => {
    const v4 = render({ protocol: "v4", poolId: ID, chain: chainBySlug("base")!, hookMayAlterSwaps: true });

    expect(v4).toContain(`embed/pool?chain=base&amp;amp;id=${ID}`);
    expect(v4).toContain("height=&quot;260&quot;");
  });

  it("speaks the reader's language, and offers the card in it", () => {
    const turkish = render({ locale: "tr" });

    expect(turkish).toContain("Bu havuzu sitene ekle");
    expect(turkish).toContain("lang=tr");
    expect(turkish).not.toContain("Embed this pool");
  });
});
