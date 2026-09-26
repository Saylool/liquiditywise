import type { MostTradedList, MostTradedPool } from "../lib/advisor/mostTraded";
import type { MostTraded } from "../lib/advisor/readMostTraded";
import { poolAnalysisHref, v4PoolAnalysisHref } from "../lib/advisor/requestedParameters";
import { V4_POOL_DAYS_WINDOW } from "../lib/uniswap/ethereumV4PoolDays";
import { formatFeePpm, formatPercent, formatUsd, formatWhole } from "../lib/format/displayFormats";
import { priceStepRatio } from "../lib/format/priceStep";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { MostTradedCopy } from "../lib/i18n/mostTradedCopy";
import type { PriceBandParameters } from "../schemas";
import { GuardedLink } from "./GuardedLink";
import { type Chain, CHAINS, ETHEREUM } from "../lib/chains/chains";

/*
 * The week's most traded pools, v3 and v4 apart.
 *
 * Each card is a pool's week: its pair and fee, what it traded and what it
 * charged, and the way into its own page, where a range and a deposit turn
 * those into something about a position. The two halves are not merged into
 * one list: a v3 tier and a v4 pool with a hook are different instruments,
 * and one order across both would read as a verdict between them.
 */

type Shared = {
  readonly chain: Chain;
  readonly copy: MostTradedCopy;
  readonly parameters: PriceBandParameters;
  readonly t: Dictionary;
  readonly locale: Locale;
};

const feeLabel = ({ pool }: MostTradedPool, { t, locale }: Shared): string => {
  if (pool.protocolVersion === "v3") return formatFeePpm(pool.feePpm, locale);
  const fee =
    pool.fee.kind === "static"
      ? formatFeePpm(pool.fee.feePpm, locale)
      : pool.fee.kind === "dynamic"
        ? t.v4.dynamicFee
        : t.v4.feeUnread;

  return `${fee} · ${t.feeTiers.priceStep(formatPercent(priceStepRatio(pool.tickSpacing), locale))}`;
};

const PoolCard = ({ entry, shared }: { entry: MostTradedPool; shared: Shared }) => {
  const { chain, copy, parameters, t, locale } = shared;
  const { pool } = entry;
  const href =
    pool.protocolVersion === "v3"
      ? poolAnalysisHref(pool.id, parameters, undefined, chain)
      : v4PoolAnalysisHref(pool.id, parameters, undefined, chain);

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <header className="flex flex-col gap-1">
        <h3 className="truncate text-base font-semibold">{`${pool.token0.symbol} / ${pool.token1.symbol}`}</h3>
        <p className="font-mono text-xs text-muted">{feeLabel(entry, shared)}</p>
      </header>
      {entry.hookAltersSwaps ? (
        <p className="text-xs leading-relaxed text-muted">{`${t.feeTiers.hook}: ${t.feeTiers.hookAltersSwaps}`}</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs text-muted">{copy.volume}</dt>
          <dd className="font-mono text-sm">{formatUsd(entry.volumeUsd, locale)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs text-muted">{copy.fees}</dt>
          <dd className="font-mono text-sm">
            {entry.feesUsd === null ? copy.feesUnknown : formatUsd(entry.feesUsd, locale)}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted">
        {copy.days(formatWhole(entry.daysCounted, locale), formatWhole(V4_POOL_DAYS_WINDOW, locale))}
      </p>
      <GuardedLink className="text-link text-sm" href={href}>
        {t.compare.open}
      </GuardedLink>
    </li>
  );
};

const Half = ({ heading, list, shared }: { heading: string; list: MostTradedList; shared: Shared }) => (
  <section className="flex flex-col gap-4">
    <h2 className="text-lg font-medium tracking-tight">{heading}</h2>
    {list.status === "unavailable" ? (
      <p className="text-sm leading-relaxed text-muted">
        {`${shared.copy.unavailable} ${shared.t.notices.failure[list.notice]}`}
      </p>
    ) : list.pools.length === 0 ? (
      <p className="text-sm leading-relaxed text-muted">{shared.copy.empty}</p>
    ) : (
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.pools.map((entry) => (
          <PoolCard key={entry.pool.id} entry={entry} shared={shared} />
        ))}
      </ol>
    )}
  </section>
);

/**
 * One page per chain, reached by a tab for each: the same address with
 * `?chain=`, so the chain is in the link a reader shares.
 */
const ChainTabs = ({ current, hrefFor, label }: { current: Chain; hrefFor: (chain: Chain) => string; label: string }) => (
  <nav aria-label={label} className="flex flex-wrap gap-2">
    {CHAINS.map((chain) => (
      <a
        key={chain.slug}
        href={hrefFor(chain)}
        aria-current={chain.id === current.id ? "page" : undefined}
        className={`rounded-full border px-3 py-1 text-xs ${
          chain.id === current.id ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"
        }`}
      >
        {chain.name}
      </a>
    ))}
  </nav>
);

export function MostTradedPools({
  data,
  chain = ETHEREUM,
  pageHref,
  networkLabel,
  copy,
  parameters,
  t,
  locale,
}: {
  data: MostTraded;
  /** The chain these pools are on; v4 is read only where chains.ts says. */
  chain?: Chain;
  /** The page's own address in the reader's language, for the chain tabs. */
  pageHref: string;
  /** What the chain tabs are called for a screen reader. */
  networkLabel: string;
  copy: MostTradedCopy;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  const shared = { chain, copy, parameters, t, locale };

  return (
    <>
      <ChainTabs
        current={chain}
        label={networkLabel}
        hrefFor={(each) => (each.id === ETHEREUM.id ? pageHref : `${pageHref}?chain=${each.slug}`)}
      />
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.intro(chain.name)}</p>
      <Half heading={t.feeTiers.onV3} list={data.v3} shared={shared} />
      {data.v4 === null ? null : <Half heading={t.feeTiers.onV4} list={data.v4} shared={shared} />}
    </>
  );
}
