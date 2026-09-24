import Link from "next/link";
import type { Dictionary } from "../lib/i18n/dictionaries";
import { localePath } from "../lib/i18n/localePath";
import type { Locale } from "../lib/i18n/locales";
import { getInterfaceCopy } from "../lib/i18n/interface";
import { BrandMark, ArrowIcon } from "./BrandMark";
import { PreferenceBar } from "./PreferenceBar";
import { SiteNavigation } from "./SiteNavigation";

export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  const copy = getInterfaceCopy(locale);
  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <header className="site-header">
        <div className="header-inner">
          {/*
            * The label is the name, not a description, and it is spelled out
            * because the mark beside the wordmark would otherwise read as
            * nothing. It was left behind at the rename and still said
            * "Uniswap Advisor" — invisible on screen, and the first thing a
            * screen reader announced on every page.
            */}
          <Link href={localePath(locale, "/")} prefetch={false} className="brand" aria-label="LiquidityWise">
            <BrandMark />
            <span>
              liquidity<span className="brand-subtitle">wise</span>
            </span>
          </Link>
          <SiteNavigation
            hooksHref={localePath(locale, "/hooks")}
            copy={{
              pools: copy.pools,
              positions: copy.positions,
              hooks: copy.hooks,
              menu: copy.menu,
            }}
          />
          <PreferenceBar locale={locale} t={t} />
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const copy = getInterfaceCopy(locale);
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link href={localePath(locale, "/")} prefetch={false} className="brand">
          <BrandMark />
          <span>
            liquidity<span className="brand-subtitle">wise</span>
          </span>
        </Link>
        <p>{copy.closingTitle}</p>
        <Link href="/pool" prefetch={false} className="text-link">
          {copy.pools}
          <ArrowIcon />
        </Link>
      </div>
      <div className="footer-bottom">
        <p>{copy.independence}</p>
        <span>
          <i className="status-dot" />
          {copy.chain}
        </span>
      </div>
    </footer>
  );
}
