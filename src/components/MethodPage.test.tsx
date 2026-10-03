import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMethodCopy, METHOD_SECTION_IDS } from "../lib/i18n/methodCopy";
import { MethodPage, methodFigures } from "./MethodPage";

const render = (locale: "en" | "tr" = "tr") =>
  renderToStaticMarkup(
    <MethodPage
      copy={getMethodCopy(locale)}
      locale={locale}
      links={{
        about: { href: `/${locale}/about`, label: "about" },
        smart: { href: `/${locale}/smart-money`, label: "smart" },
      }}
    />,
  );

/* React escapes an apostrophe and a double quote in text; the copy uses both. */
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("the method page", () => {
  it("gives every section a heading and an anchor of its own, in order", () => {
    const markup = render();
    const ids = [...markup.matchAll(/<section id="([^"]+)"/g)].map(([, id]) => id);

    expect(ids).toEqual([...METHOD_SECTION_IDS]);
  });

  it("lists every section at the top, linked to its anchor", () => {
    const markup = render();

    for (const id of METHOD_SECTION_IDS) {
      expect(markup).toContain(`href="#${id}"`);
      expect(markup).toContain(escaped(getMethodCopy("tr").sections[id].title));
    }
  });

  it("prints every paragraph with the code's own figures in it", () => {
    const markup = render("en");
    const figures = methodFigures("en");

    for (const id of METHOD_SECTION_IDS) {
      for (const paragraph of getMethodCopy("en").sections[id].paragraphs(figures)) {
        expect(markup).toContain(escaped(paragraph));
      }
    }
    expect(markup).toContain("$10,000");
    expect(markup).toContain("$100,000");
  });

  it("says nothing on it is advice, and leads on to the about and smart-liquidity pages", () => {
    const markup = render();

    expect(markup).toContain(escaped(getMethodCopy("tr").notAdvice));
    expect(markup).toContain('href="/tr/about"');
    expect(markup).toContain('href="/tr/smart-money"');
  });
});
