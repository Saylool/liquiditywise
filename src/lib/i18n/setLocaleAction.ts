"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { isOpenPage, localePath, PATH_HEADER } from "./localePath";
import { isLocale, localeCookie } from "./locales";

/**
 * Remembers an explicit language choice.
 *
 * A Server Action driven by a plain `<form>`, so switching language works with
 * JavaScript disabled — the same reason the pool address form is plain HTML.
 *
 * The submitted value arrives from the network and is checked against the
 * published languages before it is stored. Without that, anything at all could
 * be written into the cookie; it would be rejected on the way back out, but a
 * cookie is a poor place to keep arbitrary text from a stranger.
 *
 * Switching language re-renders the current route, which on a pool page means
 * reading the pool again. That is inherent to rendering language on the server,
 * and the alternative — correcting the language after hydration — shows the
 * wrong one first.
 *
 * On a page reached by a language's own address (/tr/hooks) the address, not
 * the cookie, decides the language, so re-rendering would show the old one.
 * There the switch is a move to the new language's address instead. The page
 * comes from the header the proxy set, and is checked again here: it names
 * where the reader is sent.
 */
export const setLocale = async (formData: FormData): Promise<void> => {
  const requested = formData.get("locale");
  if (!isLocale(requested)) return;

  const store = await cookies();
  store.set(localeCookie(requested, process.env.NODE_ENV === "production"));

  const page = (await headers()).get(PATH_HEADER);
  if (page !== null && isOpenPage(page)) redirect(localePath(requested, page));
};
