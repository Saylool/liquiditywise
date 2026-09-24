import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import { getInterfaceCopy } from "../lib/i18n/interface";
import { WorkspaceShell } from "./WorkspaceShell";

const t = getDictionary("tr");
const heading = (markup: string) => markup.match(/<h1>([^<]*)<\/h1>/)?.[1];

describe("the workspace around a page", () => {
  it("heads a page with its navigation item's name", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceShell locale="tr" t={t} section="hooks">
        <p />
      </WorkspaceShell>,
    );

    expect(heading(markup)).toBe(getInterfaceCopy("tr").hooks.replace(/'/g, "&#x27;"));
  });

  it("heads a page the navigation does not list with its own heading", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceShell locale="tr" t={t} heading="Kısa bilgiler">
        <p />
      </WorkspaceShell>,
    );

    expect(heading(markup)).toBe("Kısa bilgiler");
  });

  it("links back to the front page at the language's own address", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceShell locale="de" t={getDictionary("de")} section="pools">
        <p />
      </WorkspaceShell>,
    );

    expect(markup).toContain('href="/de"');
  });
});
