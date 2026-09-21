import Link from "next/link";
import type { Dictionary } from "../lib/i18n/dictionaries";
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
          <Link href="/" className="brand" aria-label="Uniswap Advisor">
            <BrandMark />
            <span>
              uniswap<span className="brand-subtitle">advisor</span>
            </span>
          </Link>
          <SiteNavigation
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
        <Link href="/" className="brand">
          <BrandMark />
          <span>
            uniswap<span className="brand-subtitle">advisor</span>
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
