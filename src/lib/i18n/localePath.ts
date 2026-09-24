import { INDEXED_PAGES, SITE_URL } from "../site/indexing";
import { isLocale, LOCALES, type Locale } from "./locales";

/*
 * An address for each open page in each language: /tr, /de/hooks.
 *
 * The language is otherwise chosen by a cookie and the browser's
 * Accept-Language, which serves a reader well and a search engine not at all:
 * a crawler sends neither, so every open page was only ever read in English,
 * and a reader searching in Turkish could not find the Turkish page because to
 * a search engine there was none. A language in the address is something a
 * crawler can follow and a result can link to.
 *
 * Only the open pages have these. The closed ones read live data for one pool
 * or address, a search engine is kept off them anyway, and they keep choosing
 * the language the way they always have — which the cookie below keeps in step
 * with whatever language the reader arrived in.
 *
 * The proxy turns /tr/hooks into /hooks with the language riding along in a
 * request header; the page never learns it was reached any other way.
 */

/** Set by the proxy on a request that came in with a language in its address. */
export const LOCALE_HEADER = "x-lw-locale";

/** The page that address was for, without its language: "/" or "/hooks". */
export const PATH_HEADER = "x-lw-path";

export type OpenPage = (typeof INDEXED_PAGES)[number];

export const isOpenPage = (path: string): path is OpenPage => (INDEXED_PAGES as readonly string[]).includes(path);

/** The address of an open page in one language: ("tr", "/") → "/tr", ("tr", "/hooks") → "/tr/hooks". */
export const localePath = (locale: Locale, path: OpenPage): string => (path === "/" ? `/${locale}` : `/${locale}${path}`);

/**
 * The language and the page an address names, or `null` for any address that
 * is not one of the open pages under a published language. "/tr/pool" is
 * `null`: a closed page has no language address, and pretending otherwise would
 * be a second way into pages the robots file keeps crawlers out of.
 */
export const splitLocalePath = (pathname: string): { readonly locale: Locale; readonly path: OpenPage } | null => {
  const [, first, ...rest] = pathname.split("/");
  if (!isLocale(first)) return null;
  const path = rest.length === 0 ? "/" : `/${rest.join("/")}`;
  return isOpenPage(path) ? { locale: first, path } : null;
};

/**
 * Every language's address for one open page, plus `x-default` for the
 * address without one — which is not English but "whatever this reader's
 * browser asks for", exactly what x-default means.
 */
export const languageAlternates = (path: OpenPage): Record<string, string> => ({
  ...Object.fromEntries(LOCALES.map((locale) => [locale, `${SITE_URL}${localePath(locale, path)}`])),
  "x-default": `${SITE_URL}${path === "/" ? "" : path}`,
});

/** Every language address the proxy answers, in the form its matcher takes. */
export const localeMatchers = (): string[] =>
  INDEXED_PAGES.map((path) => `/:locale(${LOCALES.join("|")})${path === "/" ? "" : path}`);
