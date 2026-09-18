import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/*
 * The theme is three blocks that have to say the same thing.
 *
 * A colour lives once, under `--light-x` or `--dark-x`, and three separate
 * blocks map it onto the name the application uses: the light default, the
 * media query, and the explicit `data-theme="dark"`. CSS cannot share a block
 * between a media query and an attribute selector, so the repetition is forced —
 * and repetition that is forced is repetition that drifts.
 *
 * Every failure this catches is invisible in a screenshot of one theme: a token
 * added to two blocks and not the third works until somebody picks the theme
 * nobody tested, and a mapping that reaches for the wrong twin
 * (`--muted: var(--light-subtle)`) is a real colour in the right place, just not
 * the one it says.
 */

/*
 * Comments are stripped first. They are prose *about* the rules, and this file
 * documents the very mistakes being checked for — so a scanner that reads them
 * finds the example rather than the code, and reports a bug in a sentence
 * warning against it.
 */
const CSS = readFileSync(new URL("./globals.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/**
 * The text inside one block, found by matching its braces.
 *
 * Not by searching for a closing line: the blocks nest, and the first `}` at
 * any given indentation belongs to whichever block got there first. Reading to
 * the wrong one silently merges two themes into one set of mappings, where
 * every check below still passes because the right colours are all present —
 * just not in the blocks that were supposed to hold them.
 */
const blockAfter = (marker: string): string => {
  const start = CSS.indexOf(marker);
  expect(start, `${marker} is missing from globals.css`).toBeGreaterThanOrEqual(0);

  let depth = 1;
  let index = start + marker.length;
  while (index < CSS.length && depth > 0) {
    if (CSS[index] === "{") depth += 1;
    if (CSS[index] === "}") depth -= 1;
    index += 1;
  }
  expect(depth, `${marker} is never closed`).toBe(0);

  return CSS.slice(start + marker.length, index - 1);
};

/** Every `--name: var(--light-name)` or `--name: var(--dark-name)` pair in a block. */
const mappings = (block: string): ReadonlyMap<string, string> =>
  new Map(
    [...block.matchAll(/--([a-z0-9-]+):\s*var\(--(light|dark)-([a-z0-9-]+)\)/g)].map(
      ([, name, , twin]) => [name as string, twin as string],
    ),
  );

const LIGHT = mappings(blockAfter(":root {"));
const MEDIA = mappings(blockAfter(':root:not([data-theme="light"]) {'));
const EXPLICIT = mappings(blockAfter(':root[data-theme="dark"] {'));

describe("the theme's three blocks", () => {
  it("map the same set of tokens", () => {
    const light = [...LIGHT.keys()].sort();

    expect([...MEDIA.keys()].sort()).toEqual(light);
    expect([...EXPLICIT.keys()].sort()).toEqual(light);
  });

  it("maps every token at least once", () => {
    expect(LIGHT.size).toBeGreaterThan(10);
  });

  /*
   * The twin's name must be the token's own. Anything else is a colour that
   * exists, in a place that names something different — which is exactly the
   * mistake no test of "does it parse" would ever see.
   */
  it.each([
    ["the light default", LIGHT],
    ["the media query", MEDIA],
    ["the explicit dark theme", EXPLICIT],
  ])("reaches for its own twin in %s", (_label, block) => {
    for (const [name, twin] of block) expect(twin, `--${name}`).toBe(name);
  });

  it("declares a dark twin for every light one, and the other way round", () => {
    const declared = (prefix: string) =>
      [...CSS.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+):\\s*[^v]`, "g"))]
        .map(([, name]) => name)
        .sort();

    expect(declared("dark")).toEqual(declared("light"));
  });

  /*
   * A token Tailwind exposes but nothing assigns would resolve to nothing, and
   * an element using it would come out transparent rather than wrong — the
   * failure that looks like a missing element instead of a missing colour.
   */
  it("exposes only tokens the blocks assign", () => {
    const theme = blockAfter("@theme inline {");
    const exposed = [...theme.matchAll(/--(?:color-)?[a-z0-9-]+:\s*var\(--([a-z0-9-]+)\)/g)].map(
      ([, name]) => name as string,
    );

    for (const name of exposed) {
      if (name.startsWith("font-")) continue;
      expect(LIGHT.has(name), `--${name} is exposed but never assigned`).toBe(true);
    }
  });

  /*
   * `--shadow-card: var(--shadow-card)` inside `@theme inline` is a
   * self-reference, and a self-reference resolves to nothing at all. It cost a
   * silent loss of every shadow on the page once already.
   */
  it("never has a token refer to itself", () => {
    for (const [, name, reference] of CSS.matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)/g)) {
      expect(reference, `--${name} refers to itself`).not.toBe(name);
    }
  });
});
