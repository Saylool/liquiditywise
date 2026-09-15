import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PoolSearchRejection } from "../lib/search/poolSearchInput";
import { MAX_SEARCH_TERM_LENGTH, MIN_SEARCH_TERM_LENGTH } from "../schemas";
import { PoolLookupForm } from "./PoolLookupForm";

const render = (
  props: { value?: string; rejection?: PoolSearchRejection } = {},
  locale: Locale = "en",
) => renderToStaticMarkup(<PoolLookupForm t={getDictionary(locale)} {...props} />);

describe("PoolLookupForm", () => {
  /*
   * A plain GET form, so the page works with no JavaScript and a search ends up
   * somewhere that can be linked, reloaded and gone back to.
   */
  it("is a GET form that puts the query in the URL", () => {
    const markup = render();

    expect(markup).toContain('method="get"');
    expect(markup).toContain('action="/pool"');
    expect(markup).toContain('name="q"');
  });

  it("asks for either of the two things a visitor might have", () => {
    const markup = render();

    expect(markup).toContain("A pair, a v3 pool address, or a v4 pool id");
    expect(markup).toContain("WETH/USDC");
  });

  /*
   * This used to read "never connects a wallet and never sends a transaction".
   * A wallet can now be connected, and all that is asked of it is its address —
   * so half of that sentence stopped being true and had to go, while the half
   * that matters stayed. A page promising something the code no longer does is
   * worse than a page promising less.
   */
  it("says the application never signs anything", () => {
    const markup = render();

    expect(markup).toContain("never signs anything and never sends a transaction");
    expect(markup).not.toContain("never connects a wallet");
  });

  it("says it in Turkish too, where the same sentence had to change", () => {
    const markup = render({}, "tr");

    expect(markup).toContain("hiçbir şey imzalamaz ve asla işlem göndermez");
    expect(markup).not.toContain("asla cüzdan bağlamaz");
  });

  it("puts a validated value back in the box", () => {
    expect(render({ value: "weth usdc" })).toContain('value="weth usdc"');
  });

  it("leaves the box empty when there is nothing validated to put in it", () => {
    expect(render()).toContain('value=""');
  });

  it.each([
    ["empty", "Type a pair like WETH/USDC, or a pool address."],
    ["unsupported-characters", "letters, digits, and the marks that appear inside tickers"],
  ] as const)("explains a %s rejection", (rejection, expected) => {
    expect(render({ rejection })).toContain(expected);
  });

  /* The bounds come from the schema, so the sentence cannot drift away from it. */
  it("quotes the real bounds when a term was the wrong length", () => {
    const markup = render({ rejection: "length" });

    expect(markup).toContain(`between ${MIN_SEARCH_TERM_LENGTH} and ${MAX_SEARCH_TERM_LENGTH}`);
  });

  it("says nothing about a rejection when there was none", () => {
    expect(render()).not.toContain("A search term is between");
  });

  it("translates", () => {
    const markup = render({ rejection: "length" }, "tr");

    expect(markup).toContain("Bir parite, bir v3 havuz adresi ya da bir v4 havuz kimliği");
    expect(markup).toContain("Havuz bul");
    expect(markup).toContain(
      `Arama terimi ${MIN_SEARCH_TERM_LENGTH} ile ${MAX_SEARCH_TERM_LENGTH} karakter arasında olmalı.`,
    );
    expect(markup).not.toContain("Find pools");
  });
});
