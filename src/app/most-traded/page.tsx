import type { Metadata } from "next";

import { MostTradedPools } from "@/components/MostTradedPools";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getMostTraded } from "@/lib/advisor/getMostTraded";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "@/lib/advisor/poolRangeAnalysis";
import { getMostTradedCopy } from "@/lib/i18n/mostTradedCopy";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";

/*
 * The week's most traded v3 and v4 pools.
 *
 * Like the hook directory it takes no input, so it is the same page for
 * everybody and open to search engines, and its reads are shared: one every
 * ten minutes however many readers and crawlers ask. Not behind the rate
 * limiter in `proxy.ts` for the same reason the hook directory is not.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getMostTradedCopy(locale);

  return {
    title: `${copy.title} · LiquidityWise`,
    description: copy.description,
    alternates: await getOpenPageAlternates("/most-traded"),
  };
}

export default async function MostTradedPage() {
  const { locale, t } = await getRequestDictionary();
  const copy = getMostTradedCopy(locale);
  const data = await getMostTraded();

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
      <MostTradedPools data={data} copy={copy} parameters={DEFAULT_PRICE_BAND_PARAMETERS} t={t} locale={locale} />
    </WorkspaceShell>
  );
}
