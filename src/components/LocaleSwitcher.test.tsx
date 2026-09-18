import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FULLY_TRANSLATED, LOCALE_DETAILS, LOCALES } from "../lib/i18n/locales";
import { LocaleSwitcher } from "./LocaleSwitcher";

const render = (current: Parameters<typeof LocaleSwitcher>[0]["current"]) =>
  renderToStaticMarkup(<LocaleSwitcher current={current} label="Select language" />);

describe("LocaleSwitcher", () => {
  it("offers every published language, each named in itself", () => {
    const markup = render("en");

    for (const locale of LOCALES) {
      expect(markup, locale).toContain(LOCALE_DETAILS[locale].name);
      expect(markup, locale).toContain(`value="${locale}"`);
    }
  });

  it("names the one in use on the chip that opens it", () => {
    expect(render("tr")).toContain("Türkçe");
    expect(render("ar")).toContain("العربية");
  });

  it("marks which one is in use for a screen reader", () => {
    const markup = render("de");
    const german = markup.slice(markup.indexOf('value="de"'));

    expect(german.slice(0, 60)).toContain('aria-current="true"');
  });

  /*
   * A reader choosing a language should know before they choose that its
   * longer text is still English. The mark is on the entries that are not
   * finished, and on none of the ones that are.
   */
  it("marks the languages still being translated, and only those", () => {
    const markup = render("en");
    const marks = markup.split(">EN<").length - 1;

    expect(marks).toBe(LOCALES.length - FULLY_TRANSLATED.length);
  });

  /*
   * Choosing is a form submission and closing is the summary's own job, so the
   * picker works with scripts off. Neither should quietly become a script.
   */
  it("needs no JavaScript to open, choose or close", () => {
    const markup = render("en");

    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).toContain('type="submit"');
    expect(markup).not.toContain("onclick");
  });
});
