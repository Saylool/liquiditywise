import type { Metadata } from "next";
import { Suspense } from "react";

import { BandParametersForm } from "@/components/BandParametersForm";
import { PoolLookupForm } from "@/components/PoolLookupForm";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import {
  HORIZON_PARAMETER,
  MULTIPLIER_PARAMETER,
  DEPOSIT_PARAMETER,
  readRequestedParameters,
} from "@/lib/advisor/requestedParameters";
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
 *
 * The analysis below the identity is the same pipeline the v3 page runs, because
 * the geometry is the same geometry: one tick grid, one `TickMath`, and a v4
 * pool carries its spacing in its own key. What is not the same is the fee, and
 * that is measured rather than declared — see the panel that says so.
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
    <WorkspaceShell locale={locale} t={t} section="pools">
      {children}
    </WorkspaceShell>
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
  const band = readRequestedParameters(
    params[HORIZON_PARAMETER],
    params[MULTIPLIER_PARAMETER],
    params[DEPOSIT_PARAMETER],
  );

  if (!poolId.success) {
    return (
      <Shell locale={locale} t={t}>
        {/* Deliberately does not echo what arrived: it is unvalidated input. */}
        <PoolLookupForm t={t} />
        <p className="text-sm leading-relaxed text-muted">
          {requested === undefined ? t.v4.noId : t.v4.invalidId}
        </p>
      </Shell>
    );
  }

  return (
    <Shell locale={locale} t={t}>
      {/* The one box, as on the pool page: a v4 id goes back in it and reads as one. */}
      <PoolLookupForm t={t} value={poolId.data} />
      <Suspense fallback={<V4PoolPending t={t} />}>
        <V4PoolSection
          poolId={poolId.data}
          parameters={band.parameters}
          depositUsd={band.depositUsd}
          locale={locale}
          t={t}
          /*
           * Rendered by the report directly below the figures it changes, as
           * on the v3 page: the horizon and the width the analysis actually
           * used are on screen above the control that sets them.
           */
          controls={
            <BandParametersForm
              action="/v4"
              poolParameter="id"
              poolId={poolId.data}
              parameters={band.parameters}
              depositUsd={band.depositUsd}
              fellBack={band.fellBack}
              t={t}
              locale={locale}
            />
          }
        />
      </Suspense>
    </Shell>
  );
}
