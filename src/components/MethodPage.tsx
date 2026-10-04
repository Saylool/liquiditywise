import Link from "next/link";

import { HOOK_CHECK_KEPT_MS, HOOK_CHECK_RETRY_MS } from "../lib/advisor/hookCheck";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import { PAIR_RANKING_FLOOR_USD } from "../lib/advisor/pairPools";
import { SMART_POOLS } from "../lib/advisor/readSmartLiquidity";
import { HORIZON_CHOICES, MULTIPLIER_CHOICES } from "../lib/advisor/requestedParameters";
import { MIN_OWNER_SETS } from "../lib/analytics/smartHistory";
import {
  MAX_POSITIONS_PER_POOL,
  MIN_POSITION_USD,
  MIN_WINDOW_DAYS,
  SMART_SHARE,
} from "../lib/analytics/smartLiquidity";
import { CHAINS, V3_POSITION_CHAINS } from "../lib/chains/chains";
import { formatMultiplier, formatUsd, formatWhole, formatWholePercent } from "../lib/format/displayFormats";
import type { Locale } from "../lib/i18n/locales";
import { METHOD_SECTION_IDS, type MethodCopy, type MethodFigures } from "../lib/i18n/methodCopy";
import { HOOK_POOL_COUNT_CAP } from "../lib/uniswap/ethereumV4HookPools";
import { MAX_SOURCE_LAG_MS } from "../lib/uniswap/v3SourceFreshness";
import { ANNUALIZATION_DAYS, DAILY_PRICE_HISTORY_MAX_POINTS, VOLATILITY_WINDOW_DAYS } from "../schemas";

/**
 * How every figure on the site is made, section by section. Static: it reads
 * nothing, so it is the same page for everybody.
 *
 * The figures the prose names are taken from the code's own constants here,
 * not written into the copy, so the page cannot go on stating a floor the code
 * has since moved.
 */

/** A list in the reader's own words: "7, 30 or 90", "7、30 或 90". */
const list = (locale: Locale, items: readonly string[], type: "conjunction" | "disjunction"): string =>
  new Intl.ListFormat(locale, { style: "long", type }).format(items);

export const methodFigures = (locale: Locale): MethodFigures => ({
  closes: formatWhole(VOLATILITY_WINDOW_DAYS, locale),
  returns: formatWhole(VOLATILITY_WINDOW_DAYS - 1, locale),
  historyDays: formatWhole(DAILY_PRICE_HISTORY_MAX_POINTS, locale),
  yearDays: formatWhole(ANNUALIZATION_DAYS, locale),
  horizons: list(locale, HORIZON_CHOICES.map((days) => formatWhole(days, locale)), "disjunction"),
  defaultHorizon: formatWhole(DEFAULT_PRICE_BAND_PARAMETERS.horizonDays, locale),
  /*
   * Each with its σ, because a list of decimals reads as one long number in
   * every language that writes a decimal with a comma: "1, 1,5, 2 veya 3".
   */
  multipliers: list(locale, MULTIPLIER_CHOICES.map((multiplier) => `${formatMultiplier(multiplier, locale)}σ`), "disjunction"),
  defaultMultiplier: `${formatMultiplier(DEFAULT_PRICE_BAND_PARAMETERS.standardDeviationMultiplier, locale)}σ`,
  freshMinutes: formatWhole(MAX_SOURCE_LAG_MS / 60_000, locale),
  smartPools: formatWhole(SMART_POOLS, locale),
  positionsPerPool: formatWhole(MAX_POSITIONS_PER_POOL, locale),
  minPositionUsd: formatUsd(MIN_POSITION_USD, locale),
  minWindowDays: formatWhole(MIN_WINDOW_DAYS, locale),
  smartShare: formatWholePercent(SMART_SHARE, locale),
  ownerSets: formatWhole(MIN_OWNER_SETS, locale),
  pairFloorUsd: formatUsd(PAIR_RANKING_FLOOR_USD, locale),
  chains: list(locale, CHAINS.map(({ name }) => name), "conjunction"),
  smartChains: list(locale, V3_POSITION_CHAINS.map(({ name }) => name), "conjunction"),
  v4OnlyChains: list(locale, CHAINS.filter(({ v3 }) => !v3).map(({ name }) => name), "conjunction"),
  hookPoolCap: formatWhole(HOOK_POOL_COUNT_CAP, locale),
  hookCheckHours: formatWhole(HOOK_CHECK_KEPT_MS / 3_600_000, locale),
  hookCheckRetryMinutes: formatWhole(HOOK_CHECK_RETRY_MS / 60_000, locale),
});

type PageLink = { readonly href: string; readonly label: string };

export function MethodPage({
  copy,
  locale,
  links,
}: {
  copy: MethodCopy;
  locale: Locale;
  /** Where a reader goes next, each with the words its own page is linked by. */
  links: { readonly about: PageLink; readonly smart: PageLink };
}) {
  const figures = methodFigures(locale);

  return (
    <>
      <p className="max-w-2xl text-base leading-relaxed text-muted">{copy.lead}</p>

      <nav aria-labelledby="method-contents" className="flex max-w-2xl flex-col gap-3">
        <h2 id="method-contents" className="text-base font-semibold">
          {copy.contentsHeading}
        </h2>
        <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm leading-relaxed">
          {METHOD_SECTION_IDS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className="text-link">
                {copy.sections[id].title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {METHOD_SECTION_IDS.map((id) => (
        <section key={id} id={id} className="flex max-w-2xl scroll-mt-24 flex-col gap-3">
          <h2 className="text-base font-semibold">{copy.sections[id].title}</h2>
          {copy.sections[id].paragraphs(figures).map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <section className="flex max-w-2xl flex-col gap-3">
        <p className="text-sm font-medium leading-relaxed">{copy.notAdvice}</p>
        <p className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href={links.about.href} prefetch={false} className="text-link">
            {links.about.label}
          </Link>
          <Link href={links.smart.href} prefetch={false} className="text-link">
            {links.smart.label}
          </Link>
        </p>
      </section>
    </>
  );
}
