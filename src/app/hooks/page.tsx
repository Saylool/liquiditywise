import type { Metadata } from "next";

import { ChainTabs } from "@/components/ChainTabs";
import { HookDirectory } from "@/components/HookDirectory";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getHookDirectory } from "@/lib/advisor/getHookDirectory";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "@/lib/advisor/poolRangeAnalysis";
import { CHAIN_PARAMETER, readRequestedChain } from "@/lib/advisor/requestedParameters";
import { chainLabel } from "@/lib/chains/chainLabel";
import { ETHEREUM, readsV4, V4_CHAINS } from "@/lib/chains/chains";
import { getChainCopy, titleOnChain } from "@/lib/i18n/chainCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";

/*
 * Every hook the v4 net saw this week, in one place, one chain at a time.
 *
 * It takes no input but the chain, which is what separates it from every
 * other page here: a pool address, a pool id, an address to look up. There is
 * nothing to type, so there is nothing to get wrong and nothing to validate —
 * the page is the same page for everybody, and its read is the shared one
 * behind the v4 search.
 *
 * Which is also why it is not behind the rate limiter in `proxy.ts`. That
 * counts requests that will spend something upstream; this one spends a single
 * subgraph read every ten minutes however often it is asked for.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);
  const onMainnet = chain === null || chain.id === ETHEREUM.id;

  return {
    title: onMainnet ? t.metadata.hooksTitle : titleOnChain(t.metadata.hooksTitle, chain.name),
    description: t.metadata.hooksDescription,
    alternates: await getOpenPageAlternates("/hooks"),
  };
}

export default async function HooksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, t } = await getRequestDictionary();
  const chainCopy = getChainCopy(locale);
  const chain = readRequestedChain((await searchParams)[CHAIN_PARAMETER]);

  /* A chain nobody reads, or one whose v4 pools are not read, is said so — never shown as mainnet's hooks. */
  if (chain === null || !readsV4(chain.id)) {
    return (
      <WorkspaceShell locale={locale} t={t} section="hooks">
        <h2 className="text-lg font-medium tracking-tight">{t.hooks.heading}</h2>
        <p className="text-sm leading-relaxed text-muted">
          {chain === null ? chainCopy.unknown : chainCopy.v4NotRead(chain.name)}
        </p>
      </WorkspaceShell>
    );
  }

  const result = await getHookDirectory(chain.id);

  return (
    <WorkspaceShell locale={locale} t={t} section="hooks" network={chainLabel(chain.id, locale)}>
      <h2 className="text-lg font-medium tracking-tight">{t.hooks.heading}</h2>
      <ChainTabs current={chain} label={chainCopy.network} pageHref={localePath(locale, "/hooks")} chains={V4_CHAINS} />

      <HookDirectory
        result={result}
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        t={t}
        locale={locale}
      />
    </WorkspaceShell>
  );
}
