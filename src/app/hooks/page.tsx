import type { Metadata } from "next";
import Link from "next/link";

import { EducationalDisclaimer } from "@/components/EducationalDisclaimer";
import { HookDirectory } from "@/components/HookDirectory";
import { PreferenceBar } from "@/components/PreferenceBar";
import { getHookDirectory } from "@/lib/advisor/getHookDirectory";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "@/lib/advisor/poolRangeAnalysis";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";

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

  return { title: t.metadata.hooksTitle, description: t.metadata.hooksDescription };
}

export default async function HooksPage() {
  const { locale, t } = await getRequestDictionary();
  const result = await getHookDirectory();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12 sm:py-16">
      <PreferenceBar locale={locale} t={t} />
      <Link href="/" className="w-fit font-mono text-xs uppercase tracking-widest text-muted">
        {t.pool.back}
      </Link>
      <EducationalDisclaimer t={t} />

      <h1 className="text-3xl font-semibold tracking-tight">{t.hooks.heading}</h1>

      <HookDirectory
        result={result}
        parameters={DEFAULT_PRICE_BAND_PARAMETERS}
        t={t}
        locale={locale}
      />
    </main>
  );
}
