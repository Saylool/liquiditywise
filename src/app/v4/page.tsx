import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EducationalDisclaimer } from "@/components/EducationalDisclaimer";
import { PreferenceBar } from "@/components/PreferenceBar";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";
import { Bytes32HexSchema } from "@/schemas/primitives";
import { V4PoolPending, V4PoolSection } from "./V4PoolSection";

/*
 * One Uniswap v4 pool, by its PoolId.
 *
 * The id is a 32-byte hash rather than an address, because a v4 pool is not a
 * contract: it is an entry inside the singleton PoolManager, named by the
 * keccak256 of the five things that define it.
 *
 * Not indexed, like the other reading pages: every render spends a query and the
 * answer is only true for the moment it was read.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();

  return {
    title: t.metadata.v4Title,
    description: t.metadata.v4Description,
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12 sm:py-16">
      <PreferenceBar locale={locale} t={t} />
      <Link href="/" className="w-fit font-mono text-xs uppercase tracking-widest text-muted">
        {t.pool.back}
      </Link>
      <EducationalDisclaimer t={t} />
      {children}
    </main>
  );
}

/** A repeated query parameter arrives as an array; only a single value is an answer. */
const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

export default async function V4PoolPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const params = await searchParams;
  const requested = params.id;
  const poolId = Bytes32HexSchema.safeParse(single(requested));

  if (!poolId.success) {
    return (
      <Shell locale={locale} t={t}>
        {/* Deliberately does not echo what arrived: it is unvalidated input. */}
        <p className="text-sm leading-relaxed text-muted">
          {requested === undefined ? t.v4.noId : t.v4.invalidId}
        </p>
      </Shell>
    );
  }

  return (
    <Shell locale={locale} t={t}>
      <Suspense fallback={<V4PoolPending t={t} />}>
        <V4PoolSection poolId={poolId.data} locale={locale} t={t} />
      </Suspense>
    </Shell>
  );
}
