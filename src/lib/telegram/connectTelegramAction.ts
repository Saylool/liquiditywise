"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { EvmAddressSchema } from "../../schemas/primitives";
import { getRequestLocale } from "../i18n/requestLocale";
import { telegramSetup } from "./environment";
import { createPendingLink, forgetLink, TELEGRAM_LINK_COOKIE } from "./links";
import { newLinkToken } from "./linkToken";
import { chainBySlug, ETHEREUM } from "../chains/chains";

/*
 * The two things a reader can do about alerts from the site: ask for them,
 * and stop them.
 *
 * Asking mints a token, records a pending link for the address on the page,
 * remembers the token in a cookie so the page can later say the link is
 * live, and sends the reader to the bot with the token in the deep link.
 * Nothing about the reader is stored until the bot is handed the token —
 * the pending record expires on its own if they never do.
 *
 * Both are Server Actions behind plain forms, working with scripts off.
 */

export const connectTelegram = async (formData: FormData): Promise<void> => {
  const setup = telegramSetup();
  if (setup === null) return;

  const address = EvmAddressSchema.safeParse(formData.get("address"));
  if (!address.success) return;
  /* No chain is mainnet; a chain nobody reads is refused rather than followed on mainnet. */
  const requestedChain = formData.get("chain");
  const chain = requestedChain === null ? ETHEREUM : typeof requestedChain === "string" ? chainBySlug(requestedChain) : null;
  if (chain === null) return;

  const token = newLinkToken();
  const written = await createPendingLink(setup.store, token, {
    address: address.data,
    chainId: chain.id,
    locale: await getRequestLocale(),
    now: new Date(),
  });
  if (!written) return;

  const store = await cookies();
  store.set({
    name: TELEGRAM_LINK_COOKIE,
    value: token,
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(`https://t.me/${setup.username}?start=${token}`);
};

export const disconnectTelegram = async (): Promise<void> => {
  const store = await cookies();
  const token = store.get(TELEGRAM_LINK_COOKIE)?.value;
  store.delete(TELEGRAM_LINK_COOKIE);

  const setup = telegramSetup();
  if (setup === null || token === undefined) return;

  await forgetLink(setup.store, token);
};
