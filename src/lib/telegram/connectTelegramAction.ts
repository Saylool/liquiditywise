"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { EvmAddressSchema } from "../../schemas/primitives";
import { getRequestLocale } from "../i18n/requestLocale";
import { telegramSetup } from "./environment";
import { createPendingLink, forgetLink, readLink, TELEGRAM_LINK_COOKIE } from "./links";
import { newLinkToken } from "./linkToken";
import { TELEGRAM_LINK_BUDGET } from "./telegramLinkBudget";
import { chainBySlug, ETHEREUM } from "../chains/chains";
import { spendActionBudget } from "../ratelimit/actionBudget";
import { clientKeyFromHeaders } from "../ratelimit/clientKey";

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
 *
 * **Asking is budgeted, inside the action.** It is a POST anybody can send
 * without the page, and each one used to be a fresh record in the store: a
 * loop could have filled it. So before anything is written the request is
 * counted (ratelimit/actionBudget.ts) — `TELEGRAM_LINK_BUDGET.perClient` (telegramLinkBudget.ts) per
 * client and `TELEGRAM_LINK_BUDGET.global` over everybody, per half hour, the
 * life of a pending link, so at most twice the global count is ever pending
 * at once. And a browser that already has a pending link gives it up before
 * it is handed another: its cookie names the one it minted, and that one is
 * deleted, so pressing the button ten times leaves one pending link, not ten.
 * A link already claimed is left alone: it belongs to a chat now, and only
 * that chat, or the button that forgets it, ends it.
 *
 * Refused, the action does nothing and the page is drawn again as it was, as
 * for every other request it cannot act on.
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

  const client = clientKeyFromHeaders(await headers());
  const budget = await spendActionBudget(setup.store, TELEGRAM_LINK_BUDGET, { clientKey: client, secret: setup.webhookSecret, now: Date.now() });
  if (budget !== "allowed") return;

  const store = await cookies();
  const outstanding = store.get(TELEGRAM_LINK_COOKIE)?.value;
  if (outstanding !== undefined) {
    const link = await readLink(setup.store, outstanding);
    if (link !== null && link !== undefined && link.chatId === null) await forgetLink(setup.store, outstanding);
  }

  const token = newLinkToken();
  const written = await createPendingLink(setup.store, token, {
    address: address.data,
    chainId: chain.id,
    locale: await getRequestLocale(),
    now: new Date(),
  });
  if (!written) return;

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
