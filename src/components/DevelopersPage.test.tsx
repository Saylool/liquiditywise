import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CHAINS } from "../lib/chains/chains";
import {
  EMBED_FIELDS,
  EMBED_PARAMETERS,
  EMBED_STATUSES,
  EXAMPLE_CURL,
  EXAMPLE_FETCH,
  EXAMPLE_RESPONSE,
  EXAMPLE_SNIPPET,
} from "../lib/embed/embedDocs";
import { DEVELOPERS_SECTION_IDS, getDevelopersCopy } from "../lib/i18n/developersCopy";
import { LOCALES, type Locale } from "../lib/i18n/locales";
import { LICENSE_URL, REPOSITORY_URL } from "../lib/site/repository";
import { developerFigures, DevelopersPage } from "./DevelopersPage";

const render = (locale: Locale = "en") =>
  renderToStaticMarkup(
    <DevelopersPage
      copy={getDevelopersCopy(locale)}
      locale={locale}
      links={{ method: { href: `/${locale}/method`, label: "method" } }}
    />,
  );

/* React escapes these in text; the code samples use all of them. */
const escaped = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

/** Every block of code on the page, as its markup. */
const blocks = (markup: string) => [...markup.matchAll(/<pre[^>]*>[\s\S]*?<\/pre>/g)].map(([block]) => block);

describe("the developers page", () => {
  const markup = render();

  it("gives every section a heading and an anchor of its own, in order, and lists them at the top", () => {
    const ids = [...markup.matchAll(/<section id="([^"]+)"/g)].map(([, id]) => id);

    expect(ids).toEqual([...DEVELOPERS_SECTION_IDS]);
    for (const id of DEVELOPERS_SECTION_IDS) {
      expect(markup).toContain(`href="#${id}"`);
      expect(markup).toContain(escaped(getDevelopersCopy("en").sections[id]));
    }
  });

  it("shows the frame to paste, the JSON's example answer and every sample, character for character", () => {
    for (const code of [EXAMPLE_SNIPPET, EXAMPLE_CURL, EXAMPLE_FETCH, JSON.stringify(EXAMPLE_RESPONSE, null, 2)]) {
      expect(markup).toContain(escaped(code));
    }
  });

  it("documents every parameter, every field with its type, and every status", () => {
    for (const name of EMBED_PARAMETERS) expect(markup).toContain(`>${name}</code></dt>`);
    for (const { path, type } of EMBED_FIELDS) {
      expect(markup).toContain(`>${path}</code>`);
      expect(markup).toContain(`>${escaped(type)}</code>`);
    }
    for (const { status, error, cacheControl } of EMBED_STATUSES) {
      expect(markup).toContain(`>${error === null ? status : `${status} ${error}`}</code></h3>`);
      expect(markup).toContain(`Cache-Control: ${cacheControl}`);
    }
  });

  it("lists every network with what is read on it, and every language by its code", () => {
    for (const chain of CHAINS) {
      expect(markup).toContain(`>${chain.slug}</code></td><td class="pe-4">${chain.name}</td>`);
    }
    expect(markup).toContain(`<td class="pe-4 text-muted">not read</td>`);
    for (const code of LOCALES) expect(markup).toContain(`>${code}</code>`);
  });

  it("prints every paragraph with the code's own figures in it, its code set as code", () => {
    const copy = getDevelopersCopy("en");
    const figures = developerFigures("en");
    const firstCard = copy.card(figures)[0]!;

    expect(markup).toContain(`<code dir="ltr" translate="no"`);
    expect(markup).toContain(escaped(firstCard.split("`")[2]!));
    /* The fetch sample has a template literal in it; the prose has no backtick left. */
    expect(markup.replace(/<pre[\s\S]*?<\/pre>/g, "")).not.toContain("`");
    expect(markup).toContain("10 requests per client in a window of 60 seconds");
    expect(markup).toContain("300 seconds for the figures");
  });

  /*
   * The document clips whatever overflows it, so a line of code wider than a
   * phone would not scroll off the side: it would be cut off, unseen. Every
   * block scrolls inside itself instead, can be reached by keyboard, and reads
   * left to right in any language.
   */
  it("scrolls every block of code inside itself, never the page", () => {
    const pres = blocks(markup);

    expect(pres.length).toBeGreaterThanOrEqual(6 + EMBED_STATUSES.length);
    for (const pre of pres) {
      const opening = /<pre[^>]*>/.exec(pre)?.[0] ?? "";
      expect(opening, opening).toContain("overflow-x-auto");
      expect(opening, opening).toContain("min-w-0");
      expect(opening, opening).toContain("max-w-full");
      expect(opening, opening).toContain("select-all");
      expect(opening, opening).toContain('tabindex="0"');
      expect(opening, opening).toContain('dir="ltr"');
    }
    expect(markup).toMatch(/<div class="scroll-hint min-w-0 overflow-x-auto"><table/);
  });

  it("shows the same code in every language, and only the prose changes", () => {
    for (const locale of ["ar", "zh-Hant", "tr"] as const) {
      expect(blocks(render(locale)), locale).toEqual(blocks(markup));
    }
  });

  it("leads on to the method page, the code and its licence, and runs no script", () => {
    const turkish = render("tr");

    expect(turkish).toContain('href="/tr/method"');
    expect(markup).toContain(`href="${REPOSITORY_URL}"`);
    expect(markup).toContain(`href="${LICENSE_URL}"`);
    expect(markup).not.toContain("<script");
  });
});
