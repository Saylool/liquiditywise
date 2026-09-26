import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getInterfaceCopy } from "../lib/i18n/interface";
import { AddressLookupForm } from "./AddressLookupForm";

describe("the address box", () => {
  it("offers every chain read, with the current one chosen, in the same form", () => {
    const html = renderToStaticMarkup(
      <AddressLookupForm copy={getInterfaceCopy("en")} network={{ label: "Network", current: "arbitrum" }} />,
    );

    expect(html).toContain('<select id="address-chain" name="chain">');
    expect(html).toContain('<option value="arbitrum" selected="">Arbitrum One</option>');
    expect(html.indexOf('name="chain"')).toBeLessThan(html.indexOf("</form>"));
  });

  it("reads mainnet, with no choice offered, where it is not told the chain", () => {
    expect(renderToStaticMarkup(<AddressLookupForm copy={getInterfaceCopy("en")} />)).not.toContain('name="chain"');
  });
});
