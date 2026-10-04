import type { Metadata } from "next";

import { DevelopersPage } from "@/components/DevelopersPage";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getDevelopersCopy } from "@/lib/i18n/developersCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getMethodCopy } from "@/lib/i18n/methodCopy";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";

/*
 * What another site can build on — the embeddable pool card and the JSON
 * behind it — for the developer who will write against them. Reads nothing,
 * so it is the same page for everybody, costs nothing to render, and is open
 * to search engines; the card and the JSON it documents are not.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getDevelopersCopy(locale);

  return {
    title: `${copy.title} · LiquidityWise`,
    description: copy.description,
    alternates: await getOpenPageAlternates("/developers"),
  };
}

export default async function Developers() {
  const { locale, t } = await getRequestDictionary();
  const copy = getDevelopersCopy(locale);

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
      <DevelopersPage
        copy={copy}
        locale={locale}
        links={{ method: { href: localePath(locale, "/method"), label: getMethodCopy(locale).link } }}
      />
    </WorkspaceShell>
  );
}
