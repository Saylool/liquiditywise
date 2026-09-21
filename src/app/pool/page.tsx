import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BandParametersForm } from "@/components/BandParametersForm";
import { PoolExplanationPending } from "@/components/PoolExplanation";
import { PoolFeeTiersPending } from "@/components/PoolFeeTiers";
import { PoolLookupForm } from "@/components/PoolLookupForm";
import { PoolRangeReport } from "@/components/PoolRangeReport";
import { PoolSearchPending } from "@/components/PoolSearchResults";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { V4PoolSearchPending } from "@/components/V4PoolSearchResults";
import { getPoolRangeAnalysis } from "@/lib/advisor/getPoolRangeAnalysis";
import { getRangePreferences } from "@/lib/advisor/requestRangePreferences";
import {
  HORIZON_PARAMETER,
  MULTIPLIER_PARAMETER,
  DEPOSIT_PARAMETER,
  readRequestedParameters,
} from "@/lib/advisor/requestedParameters";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";
import { readPoolSearchInput } from "@/lib/search/poolSearchInput";
import { EvmAddressSchema } from "@/schemas/primitives";
import { PoolExplanationSection } from "./PoolExplanationSection";
import { PoolFeeTiersSection } from "./PoolFeeTiersSection";
import { PoolSearchSection } from "./PoolSearchSection";
import { V4PoolSearchSection } from "./V4PoolSearchSection";

/*
 * The route that runs the whole pipeline against live data, and the way in.
 *
 * Two things happen here, decided by which parameter arrived:
 *
 *   - `?address=` analyses one pool. It is the canonical form, the one every
 *     result links to and the one worth bookmarking.
 *   - `?q=` searches for pools by the names of their tokens, because nobody
 *     carries pool addresses around. A `q` that turns out to *be* an address is
 *     redirected to the canonical form rather than handled twice.
 *
 * Both arrive in the query string rather than a path segment or a request body,
 * which is what lets the form below be plain HTML: a GET form can fill a query
 * string with no JavaScript at all, and a search that lives in a URL can be
 * linked, reloaded and gone back to.
 *
 * No pool address is hardcoded anywhere. Shipping one would mean asserting from
 * memory which contract a pair lives at, and an address this application cannot
 * verify has no place in its UI.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();

  return {
    title: t.metadata.poolTitle,
    description: t.metadata.poolDescription,
    /*
     * Every render of this page spends third-party API quota, and the result is
     * only meaningful for the moment it was fetched. Neither property suits a
     * search index.
     */
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

export default async function PoolRangePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const params = await searchParams;

  const requestedAddress = params.address;
  const address = EvmAddressSchema.safeParse(single(requestedAddress));

  if (address.success) {
    /*
     * The band's two parameters come from the URL like the pool does, so a
     * particular reading of a particular pool is one link — and what the URL
     * does not name comes from the reader's preferences, so a pool reached
     * from a search opens the way they asked every pool to.
     */
    const requested = readRequestedParameters(
      params[HORIZON_PARAMETER],
      params[MULTIPLIER_PARAMETER],
      params[DEPOSIT_PARAMETER],
      await getRangePreferences(),
    );
    const result = await getPoolRangeAnalysis(
      "v3",
      address.data,
      requested.parameters,
      requested.depositUsd,
    );

    return (
      <Shell locale={locale} t={t}>
        <PoolLookupForm t={t} value={address.data} />
        <PoolRangeReport
          result={result}
          poolId={address.data}
          t={t}
          locale={locale}
          /*
           * Directly below the figures it changes, so the horizon and width
           * the analysis actually used are on screen above the control that
           * sets them — which is what the fallback message points at.
           */
          controls={
            <BandParametersForm
              action="/pool"
              poolParameter="address"
              poolId={address.data}
              parameters={requested.parameters}
              depositUsd={requested.depositUsd}
              fellBack={requested.fellBack}
              t={t}
              locale={locale}
            />
          }
        />
        {result.status === "unavailable" ? null : (
          /*
           * Neither of these is awaited by this component, so the figures above
           * are sent as soon as they exist and both stream in behind them. There
           * is nothing to explain, and no pair to place, when the analysis itself
           * produced nothing.
           *
           * The fee tiers come first because they are about which pool to read,
           * which is a question that precedes everything the explanation says —
           * and because they arrive in a fraction of the time the model takes.
           */
          <>
            {/*
             * v3 only, and narrowed rather than cast: the sibling tiers come
             * from the v3 subgraph's `pools(token0, token1)`, which has no v4
             * counterpart this application reads. This page only ever asks for
             * v3, so the branch is not reachable today — it is what will keep
             * the panel honest when a v4 pool arrives here.
             */}
            {result.data.pool.protocolVersion !== "v3" ? null : (
              <Suspense fallback={<PoolFeeTiersPending t={t} />}>
                <PoolFeeTiersSection
                  pool={result.data.pool}
                  parameters={result.data.parameters}
                  depositUsd={result.data.depositUsd}
                  locale={locale}
                  t={t}
                />
              </Suspense>
            )}

            <Suspense fallback={<PoolExplanationPending t={t} />}>
              <PoolExplanationSection
                analysis={result.data}
                warnings={result.status === "partial" ? result.warnings : []}
                locale={locale}
                t={t}
              />
            </Suspense>
          </>
        )}
      </Shell>
    );
  }

  if (requestedAddress !== undefined) {
    return (
      <Shell locale={locale} t={t}>
        {/* Deliberately does not echo what was typed: it is unvalidated input. */}
        <PoolLookupForm t={t} />
        <p className="text-sm leading-relaxed text-muted">{t.pool.invalidAddress}</p>
      </Shell>
    );
  }

  const query = single(params.q);
  if (query === undefined) {
    return (
      <Shell locale={locale} t={t}>
        <PoolLookupForm t={t} />
      </Shell>
    );
  }

  const input = readPoolSearchInput(query);

  /*
   * An address typed into the search box is not a search. Redirecting rather
   * than rendering the analysis here leaves exactly one URL that means "analyse
   * this pool" — the one that gets linked, bookmarked and counted.
   *
   * Safe to interpolate: the value passed a strict hex pattern to become one.
   */
  if (input.kind === "address") redirect(`/pool?address=${input.address}`);
  /* Likewise a v4 id, which has its own page. Same pattern guard, same reason. */
  if (input.kind === "v4-pool-id") redirect(`/v4?id=${input.poolId}`);

  if (input.kind === "unusable") {
    return (
      <Shell locale={locale} t={t}>
        <PoolLookupForm t={t} rejection={input.reason} />
      </Shell>
    );
  }

  return (
    <Shell locale={locale} t={t}>
      {/* The validated terms, not the raw string — which may have held a third. */}
      <PoolLookupForm t={t} value={input.terms.join(" ")} />
      {/*
       * Streamed, because a search now asks the chain what each candidate holds
       * — the figure the order rests on — and that is several batched calls. The
       * box the reader just typed into should come back immediately either way.
       */}
      <Suspense fallback={<PoolSearchPending t={t} />}>
        <PoolSearchSection terms={input.terms} locale={locale} t={t} />
      </Suspense>
      {/*
       * The same terms against the v4 subgraph, in a boundary of its own. Two
       * lists rather than one, because they are ordered by different numbers —
       * what a pool holds, and what its active liquidity is worth — and a single
       * order over both would be comparing them.
       */}
      <Suspense fallback={<V4PoolSearchPending t={t} />}>
        <V4PoolSearchSection terms={input.terms} locale={locale} t={t} />
      </Suspense>
    </Shell>
  );
}
