import Link from "next/link";
import { ArrowIcon } from "@/components/BrandMark";
import { EducationalDisclaimer } from "@/components/EducationalDisclaimer";
import { LiquidityHero } from "@/components/LiquidityHero";
import { PageMotion } from "@/components/PageMotion";
import { PoolLookupForm } from "@/components/PoolLookupForm";
import { RangeExplorer } from "@/components/RangeExplorer";
import { WalletConnect } from "@/components/WalletConnect";
import { getInterfaceCopy } from "@/lib/i18n/interface";
import { localePath } from "@/lib/i18n/localePath";
import { getLearnCopy } from "@/lib/learn/briefs";
import { getMostTradedCopy } from "@/lib/i18n/mostTradedCopy";
import type { Metadata } from "next";

import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";

/** Title and description come from the layout; this page adds where each language of it lives. */
export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await getOpenPageAlternates("/") };
}

export default async function Home() {
  const { locale, t } = await getRequestDictionary();
  const copy = getInterfaceCopy(locale);
  const learn = getLearnCopy(locale);
  return (
    <main id="main" tabIndex={-1} className="landing">
      <PageMotion />
      <LiquidityHero copy={copy} videoEnabled />
      <section
        id="explore"
        className="landing-section explore-section"
        data-reveal
      >
        <div>
          <p className="eyebrow section-kicker">{copy.searchKicker}</p>
          <h2 className="section-heading">{copy.searchTitle}</h2>
        </div>
        <div>
          <PoolLookupForm t={t} />
          <div className="pair-shortcuts">
            <span>{copy.examples}</span>
            {[
              ["WETH", "USDC"],
              ["WBTC", "WETH"],
              ["USDC", "USDT"],
            ].map(([first, second]) => (
              <Link
                key={first}
                prefetch={false}
                href={`/pool?q=${encodeURIComponent(`${first} ${second}`)}`}
              >
                <span className="token-pair" aria-hidden="true">
                  <i>
                    {first === "WBTC" ? "₿" : first === "WETH" ? "♦" : "$"}
                  </i>
                  <i>{second === "WETH" ? "♦" : "$"}</i>
                </span>
                {first} / {second}
              </Link>
            ))}
          </div>
          <Link href={localePath(locale, "/most-traded")} prefetch={false} className="text-link mt-8">
            {getMostTradedCopy(locale).link}
            <ArrowIcon />
          </Link>
        </div>
      </section>
      <section className="landing-section range-section" data-reveal>
        <div>
          <p className="eyebrow section-kicker">{copy.rangeKicker}</p>
          <h2 className="section-heading">{copy.rangeTitle}</h2>
          <p className="section-description">{copy.rangeBody}</p>
          <Link href="/pool" prefetch={false} className="text-link">
            {copy.pools}
            <ArrowIcon />
          </Link>
          <Link href={localePath(locale, "/learn")} prefetch={false} className="text-link ms-8">
            {learn.link}
          </Link>
        </div>
        <RangeExplorer
          copy={{
            rangeLabel: copy.rangeLabel,
            narrow: copy.narrow,
            wide: copy.wide,
            illustration: copy.illustration,
            current: copy.current,
            range: copy.range,
          }}
        />
      </section>
      <div className="method-wrap" id="method">
        <section className="landing-section method-section" data-reveal>
          <p className="eyebrow section-kicker">{t.home.methodHeading}</p>
          <div className="method-heading">
            <h2 className="section-heading">{copy.methodTitle}</h2>
            <span>01 → 02 → 03</span>
          </div>
          <ol className="method-steps">
            {t.home.methodSteps.map(({ step, detail }, index) => (
              <li key={step}>
                <div className="step-number">
                  <span>0{index + 1}</span>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    aria-hidden="true"
                  >
                    {index === 0 ? (
                      <>
                        <path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7Z" />
                        <path d="m8 12 3 3 5-6" />
                      </>
                    ) : index === 1 ? (
                      <>
                        <path d="M4 19V5m0 14h16M8 15v-4m5 4V8m5 7V4" />
                      </>
                    ) : (
                      <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />
                    )}
                  </svg>
                </div>
                <h3>{step}</h3>
                <p>{detail}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="landing-section tools-section" data-reveal>
        <p className="eyebrow section-kicker">{copy.toolsKicker}</p>
        <h2 className="section-heading">{copy.toolsTitle}</h2>
        <div className="tools-grid">
          <WalletConnect strings={t.wallet} />
          <article className="hook-card">
            <span className="eyebrow">UNISWAP v4</span>
            <h3>{copy.hooks}</h3>
            <p>{copy.hookIntro}</p>
            <Link href={localePath(locale, "/hooks")} prefetch={false} className="text-link">
              {t.hooks.fromHome}
              <ArrowIcon diagonal />
            </Link>
          </article>
        </div>
      </section>
      <section className="landing-section scope-section" data-reveal>
        <details className="scope-disclosure">
          <summary>{t.home.workingTodayHeading}</summary>
          <div className="scope-body">{t.home.workingTodayBody}</div>
        </details>
        <details className="scope-disclosure">
          <summary>{t.home.coverageHeading}</summary>
          <div className="scope-body">
            <div className="scope-grid">
              {t.home.coverage.map(({ version, features }) => (
                <div key={version}>
                  <h3>{version}</h3>
                  {features.map(({ name, summary }) => (
                    <div key={name}>
                      <h4>{name}</h4>
                      <p>{summary}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p>{t.home.footer}</p>
          </div>
        </details>
        <EducationalDisclaimer t={t} />
      </section>
    </main>
  );
}
