import type { Metadata } from "next";

import { SmartLiquidity } from "@/components/SmartLiquidity";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getSmartLiquidity } from "@/lib/advisor/getSmartLiquidity";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "@/lib/advisor/poolRangeAnalysis";
import { CHAIN_PARAMETER, readRequestedChain } from "@/lib/advisor/requestedParameters";
import { chainLabel } from "@/lib/chains/chainLabel";
import { V3_POSITION_CHAINS } from "@/lib/chains/chains";
import { getChainCopy } from "@/lib/i18n/chainCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getSmartLiquidityCopy } from "@/lib/i18n/smartLiquidityCopy";

/*
 * Where the best-earning liquidity sits, by pair and by range.
 *
 * Like the most-traded page it takes no input beyond the chain, so it is the
 * same page for everybody and open to search engines, and its reads are
 * shared: measured every six hours by the warmer however many readers ask.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getSmartLiquidityCopy(locale);
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);
  const onMainnet = chain === null || chain.id === 1;

  return {
    title: `${onMainnet ? copy.title : copy.titleOn(chain.name)} · LiquidityWise`,
    description: copy.description,
    alternates: await getOpenPageAlternates("/smart-money"),
  };
}

export default async function SmartMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const copy = getSmartLiquidityCopy(locale);
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);

  /* A chain nobody reads is said so, not quietly shown as mainnet's figures. */
  if (chain === null) {
    return (
      <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
        <p className="text-sm leading-relaxed text-muted">{getChainCopy(locale).unknown}</p>
      </WorkspaceShell>
    );
  }

  const read = await getSmartLiquidity(chain.id);

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading} network={chainLabel(chain.id, locale)}>
      <SmartLiquidity
        read={read}
        chain={chain}
        chains={V3_POSITION_CHAINS}
        pageHref={localePath(locale, "/smart-money")}
        networkLabel={getChainCopy(locale).network}
        copy={copy}
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        t={t}
        locale={locale}
      />
    </WorkspaceShell>
  );
}
