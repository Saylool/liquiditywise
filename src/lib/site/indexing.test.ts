import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import robots from "../../app/robots";
import sitemap from "../../app/sitemap";
import { LOCALES } from "../i18n/locales";
import { PAGES } from "../usage/usageLines";
import { BRIEF_IDS } from "../learn/briefs";
import { CLOSED_PATHS, EMBED_PAGES, INDEXED_PAGES, LEARN_TOPIC_PAGES, SITE_URL } from "./indexing";

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

/*
 * A dynamic route stands for the pages it serves: the guide's topics are one
 * `page.tsx` under `[topic]` and six open addresses.
 */
const DYNAMIC: Record<string, { readonly pages: readonly string[]; readonly alternates: string }> = {
  "/learn/[topic]": { pages: LEARN_TOPIC_PAGES, alternates: "getOpenPageAlternates(`/learn/${topic}`)" },
};

const pages = routes(APP);
const closedToCrawlers = (source: string) => /robots:\s*\{\s*index:\s*false/.test(source);

describe("which pages a search engine may read", () => {
  it("finds the pages, so it is not passing on an empty list", () => {
    const served = pages.flatMap(({ route }) => DYNAMIC[route]?.pages ?? [route]);

    expect([...served, ...EMBED_PAGES].sort()).toEqual([...PAGES].sort());
  });

  /*
   * The embeddable card and its JSON are counted and charged like pages, and
   * are route handlers: the card is written without the site's layout.
   */
  it("serves the embeddable card and its JSON from route handlers, both closed to crawlers", () => {
    for (const page of EMBED_PAGES) {
      expect(statSync(join(APP, ...page.split("/").filter(Boolean), "route.ts")).isFile(), page).toBe(true);
      expect(CLOSED_PATHS.some((closed) => page.startsWith(closed)), page).toBe(true);
      expect(INDEXED_PAGES as readonly string[], page).not.toContain(page);
    }
    expect(CLOSED_PATHS).toContain("/embed/");
  });

  it("closes every page that says it is closed, and lists every page that does not", () => {
    for (const { route, source } of pages) {
      for (const page of DYNAMIC[route]?.pages ?? [route]) {
        if (closedToCrawlers(source)) expect(CLOSED_PATHS, page).toContain(page);
        else expect(INDEXED_PAGES, page).toContain(page);
      }
    }
  });

  it("has every open page name its own address in every language", () => {
    for (const { route, source } of pages.filter(({ source }) => !closedToCrawlers(source))) {
      expect(source, route).toContain(DYNAMIC[route]?.alternates ?? `getOpenPageAlternates("${route}")`);
    }
  });

  it("has a topic page for every brief in the guide, and no other", () => {
    expect([...LEARN_TOPIC_PAGES]).toEqual(BRIEF_IDS.map((id) => `/learn/${id}`));
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
    expect(urls.some((url) => /\/(pool|v4|compare|pair|holdings)/.test(url))).toBe(false);
  });

  it("tells a crawler, beside each address, where the page is in every other language", () => {
    const turkishHooks = sitemap().find(({ url }) => url === "https://liquiditywise.com/tr/hooks");

    expect(turkishHooks?.alternates?.languages).toMatchObject({
      de: "https://liquiditywise.com/de/hooks",
      "x-default": "https://liquiditywise.com/hooks",
    });
  });

  /*
   * A robots rule is a prefix: "Disallow: /pool" closes "/pools" too, which is
   * why the most-traded page is not called that.
   */
  it("closes no open page by a closed page's prefix", () => {
    for (const open of INDEXED_PAGES) {
      for (const closed of CLOSED_PATHS) expect(open.startsWith(closed), `${open} under ${closed}`).toBe(false);
    }
  });

  it("keeps the routes that are not pages closed too", () => {
    expect(CLOSED_PATHS).toContain("/api/");
    expect(CLOSED_PATHS).toContain("/__backup/");
  });
});
