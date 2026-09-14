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

    expect(markup).toContain("A pair, or a pool address");
    expect(markup).toContain("WETH/USDC");
  });

  it("says the application never signs anything", () => {
    expect(render()).toContain("never connects a wallet and never sends a transaction");
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

    expect(markup).toContain("Bir parite ya da havuz adresi");
    expect(markup).toContain("Havuz bul");
    expect(markup).toContain(
      `Arama terimi ${MIN_SEARCH_TERM_LENGTH} ile ${MAX_SEARCH_TERM_LENGTH} karakter arasında olmalı.`,
    );
    expect(markup).not.toContain("Find pools");
  });
});
