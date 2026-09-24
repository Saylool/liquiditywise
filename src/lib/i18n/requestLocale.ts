import "server-only";

import { cookies, headers } from "next/headers";

import { getDictionary, type Dictionary } from "./dictionaries";
import { languageAlternates, LOCALE_HEADER, localePath, type OpenPage } from "./localePath";
import { isLocale, LOCALE_COOKIE, type Locale, resolveLocale } from "./locales";

/*
 * The language for the request being rendered.
 *
 * Reading a cookie and a header makes a route dynamic, which is why the landing
 * page is no longer statically prerendered. That is the price of rendering in
 * the reader's language on the first paint rather than correcting it afterwards
 * — and a page whose whole job is to be read is worth rendering correctly the
 * first time.
 */

export const getRequestLocale = async (): Promise<Locale> => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);

  // Reached by a language's own address (/tr/hooks): that language, whatever else is asked for.
  const addressed = headerList.get(LOCALE_HEADER);
  if (isLocale(addressed)) return addressed;

  return resolveLocale({
    cookieValue: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
};

/** The language and its strings together, which is what every page needs. */
export const getRequestDictionary = async (): Promise<{
  readonly locale: Locale;
  readonly t: Dictionary;
}> => {
  const locale = await getRequestLocale();

  return { locale, t: getDictionary(locale) };
};

/**
 * An open page's canonical address and its every language's address, for its
 * metadata. The canonical is the address this render was reached by — /tr for
 * the Turkish front page, / for the one that follows the browser — so each
 * language's page names itself and none is folded into another.
 */
export const getOpenPageAlternates = async (
  path: OpenPage,
): Promise<{ readonly canonical: string; readonly languages: Record<string, string> }> => {
  const addressed = (await headers()).get(LOCALE_HEADER);

  return {
    canonical: isLocale(addressed) ? localePath(addressed, path) : path,
    languages: languageAlternates(path),
  };
};
