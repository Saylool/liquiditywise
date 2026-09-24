import type { Metadata } from "next";

import { HookDirectory } from "@/components/HookDirectory";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getHookDirectory } from "@/lib/advisor/getHookDirectory";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "@/lib/advisor/poolRangeAnalysis";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";

/*
 * Every hook the v4 net saw this week, in one place.
 *
 * It takes no input, which is what separates it from every other page here: a
 * pool address, a pool id, an address to look up. There is nothing to type, so
 * there is nothing to get wrong and nothing to validate — the page is the same
 * page for everybody, and its read is the shared one behind the v4 search.
 *
 * Which is also why it is not behind the rate limiter in `proxy.ts`. That
 * counts requests that will spend something upstream; this one spends a single
 * subgraph read every ten minutes however often it is asked for.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();

  return {
    title: t.metadata.hooksTitle,
    description: t.metadata.hooksDescription,
    alternates: await getOpenPageAlternates("/hooks"),
  };
}

export default async function HooksPage() {
  const { locale, t } = await getRequestDictionary();
  const result = await getHookDirectory();

  return (
    <WorkspaceShell locale={locale} t={t} section="hooks">
      <h2 className="text-lg font-medium tracking-tight">{t.hooks.heading}</h2>

      <HookDirectory
        result={result}
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        t={t}
        locale={locale}
      />
    </WorkspaceShell>
  );
}
