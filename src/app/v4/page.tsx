import type { Metadata } from "next";
import { Suspense } from "react";

import { BandParametersForm } from "@/components/BandParametersForm";
import { PoolLookupForm } from "@/components/PoolLookupForm";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import {
  HORIZON_PARAMETER,
  MULTIPLIER_PARAMETER,
  DEPOSIT_PARAMETER,
  CHAIN_PARAMETER,
  readRequestedChain,
  readRequestedParameters,
} from "@/lib/advisor/requestedParameters";
import { chainLabel } from "@/lib/chains/chainLabel";
import { type Chain, ETHEREUM, readsV4 } from "@/lib/chains/chains";
import { getChainCopy } from "@/lib/i18n/chainCopy";
import { getRangePreferences } from "@/lib/advisor/requestRangePreferences";
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
  chain,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  /** Required, so no branch of this page can forget which network its chip names. */
  chain: Chain;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceShell locale={locale} t={t} section="pools" network={chainLabel(chain.id, locale)}>
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
  const chainCopy = getChainCopy(locale);

  /*
   * The chain first, as on the v3 page: the same id on another chain is
   * another pool or none. A chain nothing reads is refused, and a chain whose
   * v4 pools are not read is said so — never looked up on mainnet instead.
   */
  const chain = readRequestedChain(params[CHAIN_PARAMETER]);
  if (chain === null || !readsV4(chain.id)) {
    return (
      <Shell locale={locale} t={t} chain={chain ?? ETHEREUM}>
        <PoolLookupForm t={t} network={{ label: chainCopy.network, current: (chain ?? ETHEREUM).slug }} />
        <p className="text-sm leading-relaxed text-muted">
          {chain === null ? chainCopy.unknown : chainCopy.v4NotRead(chain.name)}
        </p>
      </Shell>
    );
  }
  const network = { label: chainCopy.network, current: chain.slug };

  const requested = params.id;
  const poolId = Bytes32HexSchema.safeParse(single(requested));
  const band = readRequestedParameters(
    params[HORIZON_PARAMETER],
    params[MULTIPLIER_PARAMETER],
    params[DEPOSIT_PARAMETER],
    await getRangePreferences(),
  );

  if (!poolId.success) {
    return (
      <Shell locale={locale} t={t} chain={chain}>
        {/* Deliberately does not echo what arrived: it is unvalidated input. */}
        <PoolLookupForm t={t} network={network} />
        <p className="text-sm leading-relaxed text-muted">
          {requested === undefined ? t.v4.noId : t.v4.invalidId}
        </p>
      </Shell>
    );
  }

  return (
    <Shell locale={locale} t={t} chain={chain}>
      {/* The one box, as on the pool page: a v4 id goes back in it and reads as one. */}
      <PoolLookupForm t={t} value={poolId.data} network={network} />
      <Suspense fallback={<V4PoolPending t={t} />}>
        <V4PoolSection
          poolId={poolId.data}
          chainId={chain.id}
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
              chain={chain.slug}
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
