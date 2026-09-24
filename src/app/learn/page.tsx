import type { Metadata } from "next";

import { QuickGuide } from "@/components/QuickGuide";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getInterfaceCopy } from "@/lib/i18n/interface";
import { localePath } from "@/lib/i18n/localePath";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getLearnCopy } from "@/lib/learn/briefs";

/*
 * Six things worth knowing before providing liquidity, in every language.
 *
 * It reads nothing — no pool, no source, no model — so it is the same page for
 * everybody, costs nothing to render, and is open to search engines: it is the
 * page somebody searching "what is impermanent loss" in their own language
 * should land on.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getLearnCopy(locale);

  return {
    title: `${copy.title} · LiquidityWise`,
    description: copy.description,
    alternates: await getOpenPageAlternates("/learn"),
  };
}

export default async function LearnPage() {
  const { locale, t } = await getRequestDictionary();
  const copy = getLearnCopy(locale);

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
      <QuickGuide
        copy={copy}
        pools={{ href: "/pool", label: getInterfaceCopy(locale).pools }}
        hooks={{ href: localePath(locale, "/hooks"), label: t.hooks.fromHome }}
      />
    </WorkspaceShell>
  );
}
