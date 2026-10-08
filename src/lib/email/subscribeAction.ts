"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CHAIN_PARAMETER } from "../advisor/requestedParameters";
import { type Chain, chainBySlug, ETHEREUM, readsV3Positions } from "../chains/chains";
import { getEmailDigestCopy } from "../i18n/emailDigestCopy";
import { localePath } from "../i18n/localePath";
import { getRequestLocale } from "../i18n/requestLocale";
import type { Locale } from "../i18n/locales";
import { spendActionBudget } from "../ratelimit/actionBudget";
import { clientKeyFromHeaders } from "../ratelimit/clientKey";
import { confirmationEmail } from "./digestEmail";
import { emailDigestSetup } from "./environment";
import { EMAIL_FORM_ANCHOR, EMAIL_STATUS_PARAMETER, type EmailFormStatus } from "./formStatus";
import { CONFIRM_TOKEN_TTL_MS } from "./signedToken";
import { SUBSCRIBE_BUDGET, subscribeRateLimiter } from "./subscribeLimiter";
import { isEmailAddress, normalizeAddress, requestSubscription, subscriptionIdOf } from "./subscriptions";

/*
 * The form on the weekly page: an address, a network, and the language the
 * page is in.
 *
 * A Server Action behind a plain `<form>`, like the Telegram button and the
 * language switcher, so it works with scripts off. It writes a pending record
 * and sends the one confirmation mail, then sends the reader back to the page
 * they were on with one word in the address saying what happened
 * (formStatus.ts). Nothing is sent to anybody until the link in that mail is
 * opened, and nothing about the reader is written anywhere but the record
 * subscriptions.ts describes.
 *
 * Two things are refused before anything is written. An address that is not
 * one — the only check an address gets before the confirmation that proves
 * it. And a request past its budget (subscribeLimiter.ts): a client that has
 * sent more than a few in a quarter of an hour, counted in this process, then
 * in the store every process shares — per client, and over everybody, so
 * that many clients together cannot send more than `SUBSCRIBE_BUDGET.global`
 * confirmations an hour either. The form sends a stranger a mail, and the
 * budget is what keeps it from being a way to send a lot of them. Both are
 * counted here, inside the action, which is reached by a POST that need not
 * come from the form, and not only by the proxy in front of the page.
 *
 * The form always answers the same way for an address it did and did not
 * mail. Whether an address is already on the list is that address's owner's
 * business, and the form is open to anybody.
 */

/** Where the reader goes back to: the weekly page in their language, on the chain they asked about, at the form. */
const backTo = (locale: Locale, chain: Chain, status: EmailFormStatus): string => {
  const parameters = new URLSearchParams();
  if (chain.id !== ETHEREUM.id) parameters.set(CHAIN_PARAMETER, chain.slug);
  parameters.set(EMAIL_STATUS_PARAMETER, status);
  return `${localePath(locale, "/weekly")}?${parameters.toString()}#${EMAIL_FORM_ANCHOR}`;
};

export const subscribeToDigest = async (formData: FormData): Promise<void> => {
  const locale = await getRequestLocale();

  /* The form offers the chains the smart money is measured on and no other; anything else was not sent by the form. */
  const requested = formData.get(CHAIN_PARAMETER);
  const chain = typeof requested === "string" ? chainBySlug(requested) : null;
  if (chain === null || !readsV3Positions(chain.id)) redirect(backTo(locale, ETHEREUM, "invalid"));

  /* Not set up here: the page says so, and there is nothing to do but show it again. */
  const setup = emailDigestSetup();
  if (setup === null) redirect(backTo(locale, chain, "unavailable"));

  const typed = formData.get("email");
  const address = typeof typed === "string" ? typed.trim() : "";
  if (!isEmailAddress(address)) redirect(backTo(locale, chain, "invalid"));

  const client = clientKeyFromHeaders(await headers());
  if (!subscribeRateLimiter.check(client).allowed) redirect(backTo(locale, chain, "busy"));
  const budget = await spendActionBudget(setup.store, SUBSCRIBE_BUDGET, { clientKey: client, secret: setup.secret, now: Date.now() });
  if (budget === "unavailable") redirect(backTo(locale, chain, "unavailable"));
  if (budget !== "allowed") redirect(backTo(locale, chain, "busy"));

  const id = subscriptionIdOf(setup.secret, address);
  const outcome = await requestSubscription(setup.store, id, { address, chainId: chain.id, locale });
  if (outcome === "unavailable") redirect(backTo(locale, chain, "unavailable"));

  if (outcome === "pending") {
    const expiresAt = new Date(Date.now() + CONFIRM_TOKEN_TTL_MS);
    const mail = confirmationEmail({ chainId: chain.id, locale, copy: getEmailDigestCopy(locale), subscriptionId: id, secret: setup.secret, expiresAt });
    const taken = await setup.provider.sendEmail({ to: normalizeAddress(address), ...mail });
    if (!taken) redirect(backTo(locale, chain, "unavailable"));
  }

  redirect(backTo(locale, chain, "sent"));
};
