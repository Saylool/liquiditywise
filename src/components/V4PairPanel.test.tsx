import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import { getDictionary } from "../lib/i18n/dictionaries";
import { V4PairPanel } from "./V4PairPanel";

const t = getDictionary("en");
const render = (v3NotRead?: string, chainId = 1) =>
  renderToStaticMarkup(
    <V4PairPanel
      v4Result={{ status: "unavailable", reason: "timeout", notice: "market-data-timed-out" }}
      v3Result={null}
      v3NotRead={v3NotRead}
      pair="ETH / USDC"
      token0Address={`0x${"0".repeat(40)}`}
      chainId={chainId}
      parameters={DEFAULT_PRICE_BAND_PARAMETERS}
      depositUsd={1000}
      t={t}
      locale="en"
    />,
  );

describe("the pair panel on a v4 page", () => {
  it("says why v3 is missing on a chain v3 is not read on, instead of blaming native ether", () => {
    const html = render("Unichain has no v3 here.");

    expect(html).toContain("Unichain has no v3 here.");
    expect(html).not.toContain("and v3 cannot");
  });

  it("says a pair holding native ether has no v3 form, where v3 is read", () => {
    expect(render()).toContain("and v3 cannot");
  });

  it("names the chain's own currency: wrapped ether on mainnet, wrapped POL on Polygon", () => {
    expect(render()).toContain("own currency, ETH");
    expect(render()).toContain("(WETH)");
    expect(render(undefined, 137)).toContain("own currency, POL");
    expect(render(undefined, 137)).toContain("(WPOL)");
    expect(render(undefined, 137)).not.toContain("ETH,");
  });
});
