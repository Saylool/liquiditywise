import type { Metadata } from "next";

import { MethodPage } from "@/components/MethodPage";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getAboutCopy } from "@/lib/i18n/aboutCopy";
import { localePath } from "@/lib/i18n/localePath";
import { getMethodCopy } from "@/lib/i18n/methodCopy";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getSmartLiquidityCopy } from "@/lib/i18n/smartLiquidityCopy";

/*
 * How every figure on the site is made and what each one leaves out, for a
 * liquidity provider deciding how far to trust a number and for anyone
 * reviewing the project. Reads nothing, so it is the same page for everybody,
 * costs nothing to render, and is open to search engines.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const copy = getMethodCopy(locale);

  return {
    title: `${copy.title} · LiquidityWise`,
    description: copy.description,
    alternates: await getOpenPageAlternates("/method"),
  };
}

export default async function Method() {
  const { locale, t } = await getRequestDictionary();
  const copy = getMethodCopy(locale);

  return (
    <WorkspaceShell locale={locale} t={t} heading={copy.heading}>
      <MethodPage
        copy={copy}
        locale={locale}
        links={{
          about: { href: localePath(locale, "/about"), label: getAboutCopy(locale).link },
          smart: { href: localePath(locale, "/smart-money"), label: getSmartLiquidityCopy(locale).link },
        }}
      />
    </WorkspaceShell>
  );
}
