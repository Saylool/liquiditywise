import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import robots from "../../app/robots";
import sitemap from "../../app/sitemap";
import { LOCALES } from "../i18n/locales";
import { PAGES } from "../usage/usageLines";
import { CLOSED_PATHS, INDEXED_PAGES, SITE_URL } from "./indexing";

/*
 * Every page's own metadata, the robots file and the sitemap, held to one
 * list. A page added without deciding which side it is on — as /compare was,
 * for a day — fails here rather than being crawled or hidden by accident.
 */

const APP = join(process.cwd(), "src", "app");

/** Each `page.tsx` under src/app, as the route it serves. */
const routes = (directory: string): { route: string; source: string }[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return routes(path);
    if (name !== "page.tsx") return [];
    const segment = relative(APP, directory).split(sep).filter(Boolean).join("/");
    return [{ route: `/${segment}`, source: readFileSync(path, "utf8") }];
  });

const pages = routes(APP);
const closedToCrawlers = (source: string) => /robots:\s*\{\s*index:\s*false/.test(source);

describe("which pages a search engine may read", () => {
  it("finds the pages, so it is not passing on an empty list", () => {
    expect(pages.map(({ route }) => route).sort()).toEqual([...PAGES].sort());
  });

  it("closes every page that says it is closed, and lists every page that does not", () => {
    for (const { route, source } of pages) {
      if (closedToCrawlers(source)) expect(CLOSED_PATHS, route).toContain(route);
      else expect(INDEXED_PAGES, route).toContain(route);
    }
  });

  it("tells crawlers the same thing in robots.txt, and points at the sitemap", () => {
    const rules = robots().rules as { disallow: string[] };

    expect(rules.disallow).toEqual([...CLOSED_PATHS]);
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("lists only the open pages in the sitemap, on the real host, at every address each has", () => {
    const urls = sitemap().map(({ url }) => url);

    expect(urls).toHaveLength(INDEXED_PAGES.length * (LOCALES.length + 1));
    expect(urls).toContain("https://liquiditywise.com");
    expect(urls).toContain("https://liquiditywise.com/hooks");
    expect(urls).toContain("https://liquiditywise.com/tr");
    expect(urls).toContain("https://liquiditywise.com/zh-Hant/hooks");
    expect(urls.every((url) => url.startsWith(SITE_URL))).toBe(true);
    expect(urls.some((url) => /\/(pool|v4|compare|holdings)/.test(url))).toBe(false);
  });

  it("tells a crawler, beside each address, where the page is in every other language", () => {
    const turkishHooks = sitemap().find(({ url }) => url === "https://liquiditywise.com/tr/hooks");

    expect(turkishHooks?.alternates?.languages).toMatchObject({
      de: "https://liquiditywise.com/de/hooks",
      "x-default": "https://liquiditywise.com/hooks",
    });
  });

  it("keeps the routes that are not pages closed too", () => {
    expect(CLOSED_PATHS).toContain("/api/");
    expect(CLOSED_PATHS).toContain("/__backup/");
  });
});
