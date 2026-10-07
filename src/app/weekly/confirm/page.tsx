import type { Metadata } from "next";
import Link from "next/link";

import { WorkspaceShell } from "@/components/WorkspaceShell";
import { chainOf } from "@/lib/chains/chains";
import { emailDigestSetup } from "@/lib/email/environment";
import { verifyToken } from "@/lib/email/signedToken";
import { confirmSubscription } from "@/lib/email/subscriptions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getEmailDigestCopy } from "@/lib/i18n/emailDigestCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getWeeklyCopy } from "@/lib/i18n/weeklyCopy";

/*
 * Where the link in the confirmation e-mail lands.
 *
 * The link proves itself (email/signedToken.ts): a token that does not
 * verify, or has passed its day, is answered without a read of the store.
 * One that does confirms the pending record it names — once; a second click
 * finds it confirmed and says so — and the page answers in the language the
 * reader asked in, which the record remembers, rather than the language this
 * browser happens to be set to: the mail was opened wherever it was opened.
 *
 * Closed to crawlers and listed under no language address: it does one thing
 * for one reader and is not a page to find.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();

  return { title: `${getEmailDigestCopy(locale).confirm.title} · LiquidityWise`, robots: { index: false, follow: false } };
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const request = await getRequestDictionary();
  const setup = emailDigestSetup();
  const claims = setup === null ? null : verifyToken(setup.secret, (await searchParams).token, "confirm", new Date());
  const outcome = setup === null || claims === null ? null : await confirmSubscription(setup.store, claims.id, new Date());

  /* The reader's own language where the record says it; the browser's where there is no record to ask. */
  const locale = outcome !== null && "subscription" in outcome ? outcome.subscription.locale : request.locale;
  const t = locale === request.locale ? request.t : getDictionary(locale);
  const copy = getEmailDigestCopy(locale);

  const message =
    setup === null
      ? copy.notConfigured
      : outcome === null
        ? copy.confirm.invalid
        : outcome.status === "confirmed"
          ? copy.confirm.confirmed(chainOf(outcome.subscription.chainId).name)
          : outcome.status === "already-confirmed"
            ? copy.confirm.already
            : outcome.status === "unknown"
              ? copy.confirm.unknown
              : copy.confirm.unavailable;

  const chain = outcome !== null && "subscription" in outcome ? chainOf(outcome.subscription.chainId) : null;
  const weekly = `${localePath(locale, "/weekly")}${chain === null || chain.id === 1 ? "" : `?chain=${chain.slug}`}`;

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.confirm.title}>
      <p className="max-w-2xl text-sm leading-relaxed">{message}</p>
      <p className="text-sm">
        <Link href={weekly} prefetch={false} className="text-link">
          {getWeeklyCopy(locale).link}
        </Link>
      </p>
    </WorkspaceShell>
  );
}
