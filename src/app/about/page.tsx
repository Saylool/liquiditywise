import type { Metadata } from "next";

import { AboutPage } from "@/components/AboutPage";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getAboutCopy } from "@/lib/i18n/aboutCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";

/*
 * What the project is and the facts about it, for a reader, a writer or a
 * team looking at it. Reads nothing, so it is the same page for everybody,
 * costs nothing to render, and is open to search engines.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getAboutCopy(locale);

  return {
    title: `${copy.title} · LiquidityWise`,
    description: copy.description,
    alternates: await getOpenPageAlternates("/about"),
  };
}

export default async function About() {
  const { locale, t } = await getRequestDictionary();
  const copy = getAboutCopy(locale);

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
      <AboutPage
        copy={copy}
        links={{
          pools: "/pool",
          smart: localePath(locale, "/smart-money"),
          guide: localePath(locale, "/learn"),
        }}
      />
    </WorkspaceShell>
  );
}
