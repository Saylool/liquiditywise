import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { chainOf } from "../lib/chains/chains";
import { ChainTabs } from "./ChainTabs";

describe("the chain tabs", () => {
  it("offer every chain unless told otherwise, mainnet at the page's own address", () => {
    const html = renderToStaticMarkup(<ChainTabs current={chainOf(1)} pageHref="/de/hooks" label="Netzwerk" />);

    expect(html).toContain('aria-label="Netzwerk"');
    expect(html).toContain('href="/de/hooks" aria-current="page"');
    expect(html).toContain('href="/de/hooks?chain=base"');
    expect(html).toContain('href="/de/hooks?chain=arbitrum"');
  });

  it("offer only the chains they are given, marking the one shown", () => {
    const html = renderToStaticMarkup(
      <ChainTabs current={chainOf(42161)} pageHref="/hooks" label="Network" chains={[chainOf(1), chainOf(42161)]} />,
    );

    expect(html).not.toContain("chain=base");
    expect(html).toContain('href="/hooks?chain=arbitrum" aria-current="page"');
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });
});
