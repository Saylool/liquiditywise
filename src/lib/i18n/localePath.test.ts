import { describe, expect, it } from "vitest";

import { config } from "../../proxy";
import { INDEXED_PAGES } from "../site/indexing";
import { languageAlternates, localeMatchers, localePath, splitLocalePath } from "./localePath";
import { LOCALES } from "./locales";

describe("each open page's address in each language", () => {
  it("puts the language first, and the front page is the language alone", () => {
    expect(localePath("tr", "/")).toBe("/tr");
    expect(localePath("tr", "/hooks")).toBe("/tr/hooks");
    expect(localePath("zh-Hant", "/hooks")).toBe("/zh-Hant/hooks");
  });

  it("reads every one of them back to the same language and page", () => {
    for (const locale of LOCALES) {
      for (const path of INDEXED_PAGES) {
        expect(splitLocalePath(localePath(locale, path)), `${locale} ${path}`).toEqual({ locale, path });
      }
    }
  });

  it("gives a closed page no language address, and reads nothing else as one", () => {
    expect(splitLocalePath("/tr/pool")).toBeNull();
    expect(splitLocalePath("/tr/holdings")).toBeNull();
    expect(splitLocalePath("/xx")).toBeNull();
    expect(splitLocalePath("/TR")).toBeNull();
    expect(splitLocalePath("/trx/hooks")).toBeNull();
    expect(splitLocalePath("/tr/hooks/more")).toBeNull();
    expect(splitLocalePath("/hooks")).toBeNull();
    expect(splitLocalePath("/")).toBeNull();
  });

  it("names every language's address for a page, and the browser-led one as the default", () => {
    const alternates = languageAlternates("/hooks");

    expect(Object.keys(alternates)).toEqual([...LOCALES, "x-default"]);
    expect(alternates.tr).toBe("https://liquiditywise.com/tr/hooks");
    expect(alternates["zh-Hant"]).toBe("https://liquiditywise.com/zh-Hant/hooks");
    expect(alternates["x-default"]).toBe("https://liquiditywise.com/hooks");
    expect(languageAlternates("/")["x-default"]).toBe("https://liquiditywise.com");
    expect(languageAlternates("/").de).toBe("https://liquiditywise.com/de");
  });

  it("has the proxy answer every one of them, however the matcher had to be written", () => {
    for (const matcher of localeMatchers()) expect(config.matcher).toContain(matcher);
  });
});
