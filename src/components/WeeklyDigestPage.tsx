import Link from "next/link";

import type { Mover } from "../lib/analytics/smartHistory";
import { type Chain, ETHEREUM, readsV3Positions } from "../lib/chains/chains";
import { formatPercent, formatUtcMinute, formatWhole } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import { getHomeAlertsCopy } from "../lib/i18n/homeAlertsCopy";
import { localePath } from "../lib/i18n/localePath";
import type { Locale } from "../lib/i18n/locales";
import { getSmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import type { WeeklyCopy } from "../lib/i18n/weeklyCopy";
import { keptPair, keptRanges } from "../lib/telegram/messages";
import type { RangeMove, TopYield, WeeklyReading, WeeklyWindow } from "../lib/telegram/weeklyDigest";
import { ChainTabs } from "./ChainTabs";

/*
 * The Monday digest as a page: the week's window, the pairs gaining and
 * losing a share of the smart money, the typical ranges that moved, and the
 * pairs whose smart positions earn the most — one network at a time, with a
 * tab for each the smart money is measured on.
 *
 * Every line of the digest is written the way the bot writes it, through the
 * same functions (messages.ts): the dictionary's weekly headings, a pair
 * named as the smart-money page names it, a range as prices quoted the way
 * the pair is at its price now, then → now. A reader who gets the message on
 * Monday and opens this page finds the same sentences, not a paraphrase.
 *
 * Nothing wider than a phrase: every list is a column of wrapping lines, so
 * the page holds at a phone's width without a table to clip (see
 * overflow-is-clipped). The one thing that could run long — a range with its
 * unit, then and now — breaks at its spaces.
 */

type Bot = { readonly username: string; readonly url: string } | null;

type Shared = {
  readonly copy: WeeklyCopy;
  readonly t: Dictionary;
  readonly locale: Locale;
};

/** The smart-money page on the same chain, the chain unsaid on mainnet, as in every link. */
export const smartMoneyHref = (locale: Locale, chain: Chain): string => {
  const page = localePath(locale, "/smart-money");
  return chain.id === ETHEREUM.id ? page : `${page}?chain=${chain.slug}`;
};

const Heading = ({ children }: { children: string }) => <h2 className="text-lg font-medium tracking-tight">{children}</h2>;

const Movers = ({ heading, movers, shared: { t, locale } }: { heading: string; movers: readonly Mover[]; shared: Shared }) =>
  movers.length === 0 ? null : (
    <section className="flex min-w-0 flex-col gap-2">
      <Heading>{heading}</Heading>
      <ul className="flex flex-col gap-1 text-sm">
        {movers.map(({ pool, pair, feePpm, from, to }) => (
          <li key={pool} className="break-words">
            {t.telegram.weeklyMover(keptPair(pair, feePpm, locale), formatPercent(from, locale), formatPercent(to, locale))}
          </li>
        ))}
      </ul>
    </section>
  );

const Ranges = ({ ranges, shared: { t, locale } }: { ranges: readonly RangeMove[]; shared: Shared }) =>
  ranges.length === 0 ? null : (
    <section className="flex min-w-0 flex-col gap-2">
      <Heading>{t.telegram.weeklyRanges}</Heading>
      <ul className="flex flex-col gap-1 text-sm">
        {ranges.map((range) => {
          const { then, now } = keptRanges(range, locale);
          return (
            <li key={range.pool} className="break-words">
              {t.telegram.weeklyRange(keptPair(range.pair, range.feePpm, locale), then, now)}
            </li>
          );
        })}
      </ul>
    </section>
  );

const TopYields = ({ topYields, shared: { copy, locale } }: { topYields: readonly TopYield[]; shared: Shared }) =>
  topYields.length === 0 ? null : (
    <section className="flex min-w-0 flex-col gap-2">
      <Heading>{copy.topHeading}</Heading>
      <ol className="flex flex-col gap-1 text-sm">
        {topYields.map(({ pool, pair, feePpm, yearlyYield, positions }) => (
          <li key={pool} className="break-words">
            {`${keptPair(pair, feePpm, locale)}: ${copy.topYield(formatPercent(yearlyYield, locale), formatWhole(positions, locale))}`}
          </li>
        ))}
      </ol>
    </section>
  );

/** The week read, under the heading the bot's message opens with. */
const Window = ({ window, shared: { copy, locale } }: { window: WeeklyWindow; shared: Shared }) => {
  const days = formatWhole(Math.round(window.days), locale);
  return (
    <div className="flex flex-col gap-1">
      <Heading>{getSmartLiquidityCopy(locale).trend.heading(days)}</Heading>
      <p className="text-sm text-muted">{copy.window(formatUtcMinute(window.from), formatUtcMinute(window.to), days)}</p>
    </div>
  );
};

/** Where to go on from the digest: the detail, and the bot that sends it, where there is one. */
const Onward = ({ chain, bot, shared: { copy, locale } }: { chain: Chain; bot: Bot; shared: Shared }) => (
  <>
    <p className="text-sm">
      <Link href={smartMoneyHref(locale, chain)} prefetch={false} className="text-link">
        {copy.detail}
      </Link>
    </p>
    {bot === null ? null : (
      <p className="flex max-w-2xl flex-wrap items-baseline gap-x-6 gap-y-2 text-sm leading-relaxed text-muted">
        <span>{copy.bot}</span>
        <a href={bot.url} rel="noopener noreferrer" className="text-link">
          {getHomeAlertsCopy(locale).telegramBot(bot.username)}
        </a>
      </p>
    )}
  </>
);

export function WeeklyDigestPage({
  reading,
  chain,
  chains,
  pageHref,
  networkLabel,
  copy,
  t,
  locale,
  bot,
}: {
  /** The week as the kept series tells it; `null` where nothing is kept or the store did not answer. */
  reading: WeeklyReading | null;
  chain: Chain;
  /** The chains the smart money is measured on, for the tabs. */
  chains: readonly Chain[];
  /** The page's own address in the reader's language. */
  pageHref: string;
  networkLabel: string;
  copy: WeeklyCopy;
  t: Dictionary;
  locale: Locale;
  /** The bot that sends this digest, or `null` where alerts are not set up. */
  bot: Bot;
}) {
  const shared: Shared = { copy, t, locale };
  const tabs = <ChainTabs current={chain} label={networkLabel} pageHref={pageHref} chains={chains} />;

  /* Nothing is measured where positions cannot be listed, so there is no week to tell. */
  if (!readsV3Positions(chain.id)) {
    return (
      <>
        {tabs}
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          {getSmartLiquidityCopy(locale).notRead(chain.name, chains.map(({ name }) => name).join(", "))}
        </p>
      </>
    );
  }

  const intro = <p className="max-w-2xl text-sm leading-relaxed">{copy.intro(chain.name)}</p>;

  if (reading === null) {
    return (
      <>
        {tabs}
        {intro}
        <p className="text-sm leading-relaxed text-muted">{copy.unavailable}</p>
        <Onward chain={chain} bot={bot} shared={shared} />
      </>
    );
  }

  if (reading.status === "not-yet") {
    return (
      <>
        {tabs}
        {intro}
        <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.notYet(chain.name)}</p>
        <Onward chain={chain} bot={bot} shared={shared} />
      </>
    );
  }

  return (
    <>
      {tabs}
      {intro}
      <Window window={reading.window} shared={shared} />
      {reading.status === "quiet" ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.quiet}</p>
      ) : (
        <>
          <Movers heading={t.telegram.weeklyGaining} movers={reading.digest.gaining} shared={shared} />
          <Movers heading={t.telegram.weeklyLosing} movers={reading.digest.losing} shared={shared} />
          <Ranges ranges={reading.digest.ranges} shared={shared} />
        </>
      )}
      <TopYields topYields={reading.topYields} shared={shared} />
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{t.telegram.weeklyNote}</p>
      <Onward chain={chain} bot={bot} shared={shared} />
    </>
  );
}
