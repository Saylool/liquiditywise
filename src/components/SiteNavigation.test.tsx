import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteNavigation } from "./SiteNavigation";

const browser = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => browser.path }));

const COPY = { pools: "Pools", positions: "Positions", hooks: "Hooks", menu: "Menu" };
const render = () => renderToStaticMarkup(<SiteNavigation hooksHref="/tr/hooks" copy={COPY} />);
const current = (markup: string) => markup.match(/<a[^>]*aria-current="page"[^>]*>([^<]*)</)?.[1] ?? null;

beforeEach(() => {
  browser.path = "/";
});

describe("the site navigation", () => {
  it("links the hook directory at the language's own address, and the pool pages without one", () => {
    const markup = render();

    expect(markup).toContain('href="/tr/hooks"');
    expect(markup).toContain('href="/pool"');
    expect(markup).toContain('href="/holdings"');
  });

  it("marks the hook directory current at either of its addresses", () => {
    browser.path = "/tr/hooks";
    expect(current(render())).toBe("Hooks");

    browser.path = "/hooks";
    expect(current(render())).toBe("Hooks");
  });

  it("marks the pools for a v4 pool too, and nothing on the front page", () => {
    browser.path = "/v4";
    expect(current(render())).toBe("Pools");

    browser.path = "/tr";
    expect(current(render())).toBeNull();
  });
});
