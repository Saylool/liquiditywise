import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * No link in this application prefetches. The proxy counts every request for
 * a page — against the rate limit, and as a visit in the weekly report — and
 * it cannot tell the router fetching a page ahead of a click from a reader
 * opening it: the framework strips its own `rsc` and `next-router-prefetch`
 * headers before the proxy sees the request (next/dist/server/web/adapter.js).
 * A logo linking home on every page, prefetched, was a home-page visit counted
 * with every page anybody opened.
 *
 * GuardedLink turns prefetch off for the links built from data; this holds
 * every other `<Link>` to the same rule, including the ones not written yet.
 */

const SOURCE = join(process.cwd(), "src");

const files = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });

/** Each `<Link ...>` opening tag, read to its closing `>` with braces counted, so `=>` inside a prop does not end it. */
const openingTags = (source: string): string[] => {
  const tags: string[] = [];
  for (let start = source.indexOf("<Link"); start !== -1; start = source.indexOf("<Link", start + 1)) {
    if (/[A-Za-z]/.test(source[start + 5] ?? "")) continue;
    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }
    tags.push(source.slice(start, end + 1));
  }
  return tags;
};

describe("links", () => {
  const tags = files(SOURCE).flatMap((path) =>
    openingTags(readFileSync(path, "utf8")).map((tag) => ({ where: relative(process.cwd(), path), tag })),
  );

  it("are found, so this test is not passing on an empty list", () => {
    expect(tags.length).toBeGreaterThan(5);
  });

  it("never prefetch", () => {
    const prefetching = tags.filter(({ tag }) => !/\bprefetch=\{false\}/.test(tag));

    expect(prefetching.map(({ where, tag }) => `${where}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`)).toEqual([]);
  });
});
