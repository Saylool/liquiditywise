import { describe, expect, it } from "vitest";

import { getEmailDigestCopy } from "../i18n/emailDigestCopy";
import { LOCALES } from "../i18n/locales";
import { unsubscribePage } from "./unsubscribePage";

const ACTION = "/weekly/unsubscribe?token=abc.def";

describe("the unsubscribe page", () => {
  it("asks with one button that posts to the page's own address, and never stops anything on its own", () => {
    const html = unsubscribePage("en", "ask", ACTION);

    expect(html).toContain(getEmailDigestCopy("en").unsubscribe.ask);
    expect(html).toContain(`<form method="post" action="${ACTION}">`);
    expect(html).toContain(`<button type="submit">${getEmailDigestCopy("en").unsubscribe.button}</button>`);
    expect(html).not.toContain('method="get"');
  });

  it("says what pressing it came to, with no button left to press", () => {
    for (const view of ["removed", "unknown", "unavailable", "invalid"] as const) {
      const html = unsubscribePage("en", view, ACTION);

      expect(html).toContain(getEmailDigestCopy("en").unsubscribe[view]);
      expect(html).not.toContain("<form");
    }
  });

  it("leads back to the weekly page in the same language, and is closed to crawlers", () => {
    const html = unsubscribePage("tr", "removed", ACTION);

    expect(html).toContain('href="/tr/weekly"');
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });

  it("escapes the address it posts to", () => {
    expect(unsubscribePage("en", "ask", '/weekly/unsubscribe?token="><script>')).not.toContain("<script>");
  });

  it("runs the way the language does, and shows both colour schemes, in every language", () => {
    for (const locale of LOCALES) {
      const html = unsubscribePage(locale, "ask", ACTION);

      expect(html, locale).toContain(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">`);
      expect(html, locale).toContain("prefers-color-scheme: dark");
    }
  });
});
