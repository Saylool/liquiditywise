import type { Metadata } from "next";

import { MostTradedPools } from "@/components/MostTradedPools";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getMostTraded } from "@/lib/advisor/getMostTraded";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "@/lib/advisor/poolRangeAnalysis";
import { getMostTradedCopy } from "@/lib/i18n/mostTradedCopy";
import { CHAIN_PARAMETER, readRequestedChain } from "@/lib/advisor/requestedParameters";
import { chainLabel } from "@/lib/chains/chainLabel";
import { getChainCopy } from "@/lib/i18n/chainCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";

/*
 * The week's most traded v3 and v4 pools.
 *
 * Like the hook directory it takes no input, so it is the same page for
 * everybody and open to search engines, and its reads are shared: one every
 * ten minutes however many readers and crawlers ask. Not behind the rate
 * limiter in `proxy.ts` for the same reason the hook directory is not.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getMostTradedCopy(locale);
  /* Off mainnet the list is v3 alone, and the title says so and names the chain. */
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);
  const onMainnet = chain === null || chain.id === 1;

  return {
    title: `${onMainnet ? copy.title : copy.titleOn(chain.name)} · LiquidityWise`,
    description: onMainnet ? copy.description : copy.descriptionOn(chain.name),
    alternates: await getOpenPageAlternates("/most-traded"),
  };
}

export default async function MostTradedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const copy = getMostTradedCopy(locale);
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);

  /* A chain nobody reads is said so, not quietly shown as mainnet's list. */
  if (chain === null) {
    return (
      <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
        <p className="text-sm leading-relaxed text-muted">{getChainCopy(locale).unknown}</p>
      </WorkspaceShell>
    );
  }

  const data = await getMostTraded(chain.id);

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading} network={chainLabel(chain.id, locale)}>
      <MostTradedPools
        data={data}
        chain={chain}
        pageHref={localePath(locale, "/most-traded")}
        networkLabel={getChainCopy(locale).network}
        copy={copy}
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        t={t}
        locale={locale}
      />
    </WorkspaceShell>
  );
}
