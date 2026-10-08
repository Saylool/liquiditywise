import type { Metadata } from "next";

import { MonthCases } from "@/components/MonthCases";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getKeptMonthCases } from "@/lib/advisor/getMonthCases";
import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "@/lib/advisor/poolRangeAnalysis";
import { CHAIN_PARAMETER, readRequestedChain } from "@/lib/advisor/requestedParameters";
import { chainLabel } from "@/lib/chains/chainLabel";
import { getCasesCopy } from "@/lib/i18n/casesCopy";
import { getChainCopy } from "@/lib/i18n/chainCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";

/*
 * This month, measured: the week's most traded pools, each replayed over the
 * last thirty days as its own page replays it, written up as cases.
 *
 * Like the most-traded page it takes no input beyond the chain, so it is the
 * same page for everybody and open to search engines — and like the weekly
 * page it reads only what is kept, never measuring anything: a case is two
 * dozen pool analyses, and the warmer measures each chain every six hours
 * (getMonthCases.ts). A visit before the first measurement is told so.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getCasesCopy(locale);
  /* Off mainnet the title and the description name the chain. */
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);
  const onMainnet = chain === null || chain.id === 1;

  return {
    title: `${onMainnet ? copy.title : copy.titleOn(chain.name)} · LiquidityWise`,
    description: onMainnet ? copy.description : copy.descriptionOn(chain.name),
    alternates: await getOpenPageAlternates("/cases"),
  };
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const copy = getCasesCopy(locale);
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);

  /* A chain nobody reads is said so, not quietly shown as mainnet's month. */
  if (chain === null) {
    return (
      <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
        <p className="text-sm leading-relaxed text-muted">{getChainCopy(locale).unknown}</p>
      </WorkspaceShell>
    );
  }

  const read = await getKeptMonthCases(chain.id);

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading} network={chainLabel(chain.id, locale)}>
      <MonthCases
        read={read}
        chain={chain}
        pageHref={localePath(locale, "/cases")}
        networkLabel={getChainCopy(locale).network}
        copy={copy}
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        depositUsd={DEFAULT_DEPOSIT_USD}
        t={t}
        locale={locale}
      />
    </WorkspaceShell>
  );
}
