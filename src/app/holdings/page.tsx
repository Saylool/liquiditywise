import type { Metadata } from "next";
import { Suspense } from "react";

import { WorkspaceShell } from "@/components/WorkspaceShell";
import { AddressLookupForm } from "@/components/AddressLookupForm";
import { WalletConnect } from "@/components/WalletConnect";
import { getInterfaceCopy } from "@/lib/i18n/interface";
import { getRangePreferences } from "@/lib/advisor/requestRangePreferences";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";
import { EvmAddressSchema } from "@/schemas/primitives";
import { HoldingsSection, HoldingsPending } from "./HoldingsSection";
import { PositionsSection, PositionsPending } from "./PositionsSection";
import { TelegramSection } from "./TelegramSection";

/*
 * What one address holds, and the pools that opens.
 *
 * The address arrives in the query string like everything else this application
 * knows, so a lookup is a place: linkable, reloadable, and gone back to. It is
 * public data — the same list is visible to anyone who looks the address up —
 * and it is not stored anywhere, here or upstream.
 *
 * Deliberately not indexed. Every render spends a subgraph query and a sweep of
 * contract calls, the answer is only true for the moment it was read, and an
 * address is somebody's.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();

  return {
    title: t.metadata.holdingsTitle,
    description: t.metadata.holdingsDescription,
    robots: { index: false, follow: false },
  };
}

function Shell({
  locale,
  t,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceShell locale={locale} t={t} section="positions">
      {children}
    </WorkspaceShell>
  );
}

/** A repeated query parameter arrives as an array; only a single value is an answer. */
const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const params = await searchParams;
  const requested = params.address;
  /* Every link out of this page carries a band, and it should be the reader's. */
  const { parameters } = await getRangePreferences();
  const address = EvmAddressSchema.safeParse(single(requested));

  if (!address.success) {
    return (
      <Shell locale={locale} t={t}>
        <AddressLookupForm copy={getInterfaceCopy(locale)} />
        {/* Deliberately does not echo what arrived: it is unvalidated input. */}
        <p className="text-sm leading-relaxed text-muted">
          {requested === undefined ? t.holdings.noAddress : t.holdings.invalidAddress}
        </p>
        <WalletConnect strings={t.wallet} />
      </Shell>
    );
  }

  return (
    <Shell locale={locale} t={t}>
      {/*
       * Streamed, because the sweep is the slowest read in this application: a
       * pool list and then seven batches of contract calls, spaced so the
       * endpoint answers all of them. The shell and the disclaimer reach the
       * reader immediately either way.
       */}
      {/*
       * What the address already holds, before what it could hold. It is the
       * shorter read of the two and the more specific answer, and neither waits
       * on the other: two boundaries, two streams.
       */}
      <Suspense fallback={<PositionsPending t={t} />}>
        <PositionsSection
          address={address.data}
          parameters={parameters}
          locale={locale}
          t={t}
        />
      </Suspense>

      {/*
       * Alerts, under the positions they would be about. Reads a cookie and,
       * when there is one, the store — a few milliseconds — so it needs no
       * boundary of its own.
       */}
      <TelegramSection address={address.data} t={t} />

      <Suspense fallback={<HoldingsPending t={t} />}>
        <HoldingsSection
          address={address.data}
          parameters={parameters}
          locale={locale}
          t={t}
        />
      </Suspense>
    </Shell>
  );
}
