import type { SmartHistory } from "../lib/advisor/getSmartHistory";
import { currentHoldings, type Mover, type PairTrend, type PersistentHolder } from "../lib/analytics/smartHistory";
import { MIN_POSITION_USD, MIN_WINDOW_DAYS, SMART_SHARE } from "../lib/analytics/smartLiquidity";
import type { MeasuredPosition, SmartPair } from "../lib/analytics/smartLiquidity";
import type { SmartLiquidityRead } from "../lib/advisor/readSmartLiquidity";
import { poolAnalysisHref } from "../lib/advisor/requestedParameters";
import { type Chain, ETHEREUM } from "../lib/chains/chains";
import {
  formatFeePpm,
  formatPercent,
  formatUsd,
  formatUtcMinute,
  formatWhole,
  formatWholePercent,
} from "../lib/format/displayFormats";
import { choosePriceQuote, isInverted } from "../lib/format/priceQuote";
import { type RangeAround, rangeAroundInverted, signedPercent } from "../lib/format/rangeAround";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { SmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import type { PriceBandParameters, V3PoolMetadata } from "../schemas";
import { ChainTabs } from "./ChainTabs";
import { GuardedLink } from "./GuardedLink";
import { Sparkline } from "./Sparkline";

/*
 * Where the best-earning liquidity sits: the pairs first, as the question
 * asks, then the positions themselves.
 *
 * Every range is written as how far below and above the price its edges sit,
 * in the direction the rest of the site quotes that pair — "one WETH in
 * USDC", never "one USDC in WETH" — so a range reads the same here as on the
 * pool's own page.
 */

/** How many of the smart positions are listed one by one. */
export const SMART_POSITIONS_SHOWN = 20;

type Shared = {
  readonly chain: Chain;
  readonly copy: SmartLiquidityCopy;
  readonly parameters: PriceBandParameters;
  readonly t: Dictionary;
  readonly locale: Locale;
};

/**
 * A range's edges as ratios to the price now, turned into how far below and
 * above it they sit in the quoted direction. Inverting swaps the ends.
 */
export const rangeAround = (
  pool: V3PoolMetadata,
  currentPrice: number,
  lowerRatio: number,
  upperRatio: number,
): RangeAround =>
  rangeAroundInverted(choosePriceQuote({ token0: pool.token0, token1: pool.token1 }, currentPrice).inverted, lowerRatio, upperRatio);

const rangeText = (range: RangeAround, { copy, locale }: Shared): string =>
  copy.rangeValue(signedPercent(range.below, locale), signedPercent(range.above, locale));

const pairName = (pool: V3PoolMetadata, locale: Locale): string =>
  `${pool.token0.symbol} / ${pool.token1.symbol} · ${formatFeePpm(pool.feePpm, locale)}`;

const holdingsHref = (owner: string, chain: Chain): string =>
  chain.id === ETHEREUM.id ? `/holdings?address=${owner}` : `/holdings?chain=${chain.slug}&address=${owner}`;

const Figure = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className="font-mono text-sm">{value}</dd>
  </div>
);

const PairCard = ({ pair, shared }: { pair: SmartPair; shared: Shared }) => {
  const { chain, copy, parameters, t, locale } = shared;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <header className="flex flex-col gap-1">
        <h3 className="truncate text-base font-semibold">{pairName(pair.pool, locale)}</h3>
        <p className="text-xs text-muted">{copy.positions(formatWhole(pair.positions, locale))}</p>
      </header>
      <dl className="grid grid-cols-2 gap-3">
        <Figure label={copy.value} value={formatUsd(pair.valueUsd, locale)} />
        <Figure label={copy.medianYield} value={formatPercent(pair.medianYearlyYield, locale)} />
      </dl>
      <dl>
        <Figure
          label={copy.range}
          value={rangeText(rangeAround(pair.pool, pair.currentPrice, pair.medianLowerRatio, pair.medianUpperRatio), shared)}
        />
      </dl>
      <GuardedLink className="text-link text-sm" href={poolAnalysisHref(pair.pool.id, parameters, undefined, chain)}>
        {t.compare.open}
      </GuardedLink>
    </li>
  );
};

const PositionRow = ({ position, shared }: { position: MeasuredPosition; shared: Shared }) => {
  const { chain, copy, locale } = shared;
  const range = rangeAround(
    position.pool,
    position.currentPrice,
    position.lowerPrice / position.currentPrice,
    position.upperPrice / position.currentPrice,
  );
  return (
    <li className="flex min-w-0 flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{pairName(position.pool, locale)}</span>
        <span className="font-mono text-sm">{`${formatPercent(position.yearlyYield, locale)} ${copy.yearly}`}</span>
      </div>
      <p className="text-xs text-muted">
        {`${formatUsd(position.valueUsd, locale)} · ${copy.earned(formatUsd(position.feesUsd, locale), formatWhole(Math.floor(position.days), locale))}`}
      </p>
      <p className="text-xs text-muted">{`${copy.ownRange}: ${rangeText(range, shared)}`}</p>
      <p className="flex min-w-0 flex-wrap gap-x-2 text-xs text-muted">
        <span>{copy.owner}</span>
        <span className="break-all font-mono">{position.owner}</span>
        <GuardedLink className="text-link" href={holdingsHref(position.owner, chain)}>
          {copy.ownerPositions}
        </GuardedLink>
      </p>
    </li>
  );
};

/** A range's edges as ratios, quoted the way the pair is at its price now. */
const ratiosText = (
  ratios: { readonly lowerRatio: number; readonly upperRatio: number },
  price: number,
  { copy, locale }: Shared,
): string => {
  const range = rangeAroundInverted(isInverted(price), ratios.lowerRatio, ratios.upperRatio);
  return copy.rangeValue(signedPercent(range.below, locale), signedPercent(range.above, locale));
};

const named = (pair: string, feePpm: number, locale: Locale): string => `${pair} · ${formatFeePpm(feePpm, locale)}`;

const TrendCard = ({ trend, shared }: { trend: PairTrend; shared: Shared }) => {
  const { copy, locale } = shared;
  const first = trend.widths[0];
  const last = trend.widths[trend.widths.length - 1];

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-5">
      <h3 className="truncate text-base font-semibold">{named(trend.pair, trend.feePpm, locale)}</h3>
      {first === undefined || last === undefined ? null : (
        <Sparkline
          values={trend.widths}
          label={copy.trend.widthLabel(formatPercent(first, locale), formatPercent(last, locale))}
        />
      )}
      <p className="text-xs leading-relaxed text-muted">
        {trend.then === null
          ? copy.trend.rangeNew(ratiosText(trend.now, trend.currentPrice, shared))
          : copy.trend.range(ratiosText(trend.then, trend.currentPrice, shared), ratiosText(trend.now, trend.currentPrice, shared))}
      </p>
      <p className="text-xs leading-relaxed text-muted">
        {trend.shareThen === null
          ? copy.trend.shareNew(formatPercent(trend.shareNow, locale))
          : copy.trend.share(formatPercent(trend.shareThen, locale), formatPercent(trend.shareNow, locale))}
      </p>
    </li>
  );
};

const Movers = ({ heading, movers, locale, copy }: { heading: string; movers: readonly Mover[]; locale: Locale; copy: SmartLiquidityCopy }) =>
  movers.length === 0 ? null : (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-xs uppercase tracking-widest text-muted">{heading}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {movers.map(({ pool, pair, feePpm, from, to }) => (
          <li key={pool}>{copy.trend.mover(named(pair, feePpm, locale), formatPercent(from, locale), formatPercent(to, locale))}</li>
        ))}
      </ul>
    </div>
  );

const TrendSection = ({ history, shared }: { history: SmartHistory; shared: Shared }) => {
  const { copy, locale } = shared;
  const { trend } = history;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium tracking-tight">
        {copy.trend.heading(formatWhole(trend === null ? 7 : Math.round(trend.days), locale))}
      </h2>
      {trend === null ? (
        <p className="text-sm leading-relaxed text-muted">{copy.trend.notYet}</p>
      ) : (
        <>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.trend.intro}</p>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trend.pairs.map((pair) => (
              <TrendCard key={pair.pool} trend={pair} shared={shared} />
            ))}
          </ol>
          <div className="grid gap-4 sm:grid-cols-2">
            <Movers heading={copy.trend.gaining} movers={trend.gaining} locale={locale} copy={copy} />
            <Movers heading={copy.trend.losing} movers={trend.losing} locale={locale} copy={copy} />
          </div>
        </>
      )}
    </section>
  );
};

const HolderRow = ({
  holder,
  now,
  shared,
}: {
  holder: PersistentHolder;
  now: { readonly positions: number; readonly valueUsd: number } | undefined;
  shared: Shared;
}) => {
  const { chain, copy, locale } = shared;

  return (
    <li className="flex min-w-0 flex-col gap-1 border-t border-border pt-3">
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="break-all font-mono text-sm">{holder.address}</span>
        <span className="text-xs uppercase tracking-widest text-muted">{holder.contract ? copy.holders.contract : copy.holders.wallet}</span>
      </p>
      <p className="text-xs text-muted">{copy.holders.seen(formatWhole(holder.appeared, locale), formatWhole(holder.of, locale))}</p>
      <p className="text-xs text-muted">
        {now === undefined
          ? copy.holders.gone
          : copy.holders.now(formatWhole(now.positions, locale), formatUsd(now.valueUsd, locale))}
      </p>
      <p className="text-xs">
        <GuardedLink className="text-link" href={holdingsHref(holder.address, chain)}>
          {copy.ownerPositions}
        </GuardedLink>
      </p>
    </li>
  );
};

const HoldersSection = ({
  history,
  smart,
  shared,
}: {
  history: SmartHistory;
  smart: readonly MeasuredPosition[];
  shared: Shared;
}) => {
  const { copy, locale } = shared;
  const { holders } = history;
  const holdings = currentHoldings(smart);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium tracking-tight">{copy.holders.heading}</h2>
      {holders === null ? (
        <p className="text-sm leading-relaxed text-muted">{copy.holders.notYet}</p>
      ) : holders.length === 0 ? null : (
        <>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.holders.intro(formatWhole(holders[0]?.of ?? 0, locale))}</p>
          <ol className="flex flex-col gap-3">
            {holders.map((holder) => (
              <HolderRow key={holder.address} holder={holder} now={holdings.get(holder.address)} shared={shared} />
            ))}
          </ol>
          {holders.some(({ contract }) => contract) ? (
            <p className="max-w-2xl text-xs leading-relaxed text-muted">{copy.holders.contractNote}</p>
          ) : null}
        </>
      )}
      <p className="max-w-2xl text-xs leading-relaxed text-muted">{copy.holders.kept}</p>
    </section>
  );
};

export function SmartLiquidity({
  read,
  history = null,
  chain,
  chains,
  pageHref,
  networkLabel,
  copy,
  parameters,
  t,
  locale,
}: {
  /** `null` on a chain whose positions cannot be listed. */
  read: SmartLiquidityRead | null;
  /** What the kept measurements say over the last days; `null` where the deployment keeps none. */
  history?: SmartHistory | null;
  chain: Chain;
  /** The chains the page is read on, for the tabs and for saying which they are. */
  chains: readonly Chain[];
  pageHref: string;
  networkLabel: string;
  copy: SmartLiquidityCopy;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  const shared = { chain, copy, parameters, t, locale };
  const tabs = <ChainTabs current={chain} label={networkLabel} pageHref={pageHref} chains={chains} />;

  if (read === null) {
    return (
      <>
        {tabs}
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          {copy.notRead(chain.name, chains.map(({ name }) => name).join(", "))}
        </p>
      </>
    );
  }

  const method = (
    <p className="max-w-2xl text-sm leading-relaxed text-muted">
      {copy.method(formatUsd(MIN_POSITION_USD, locale), formatWhole(MIN_WINDOW_DAYS, locale), formatWholePercent(SMART_SHARE, locale))}
    </p>
  );

  if (read.status === "unavailable") {
    return (
      <>
        {tabs}
        {method}
        <p className="text-sm leading-relaxed text-muted">{`${copy.unavailable} ${t.notices.failure[read.notice]}`}</p>
      </>
    );
  }

  const { data } = read;
  return (
    <>
      {tabs}
      <p className="max-w-2xl text-sm leading-relaxed">{copy.intro(chain.name, formatWhole(read.poolsAsked, locale))}</p>
      {method}
      {data.smart.length === 0 || data.medianYearlyYield === null || data.smartFrom === null ? (
        <p className="text-sm leading-relaxed text-muted">{copy.empty}</p>
      ) : (
        <>
          <p className="max-w-2xl text-sm leading-relaxed">
            {copy.summary(
              formatWhole(data.measured, locale),
              formatWhole(data.smart.length, locale),
              formatPercent(data.smartFrom, locale),
              formatPercent(data.medianYearlyYield, locale),
            )}
          </p>
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-medium tracking-tight">{copy.pairsHeading}</h2>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.pairs.map((pair) => (
                <PairCard key={pair.pool.id} pair={pair} shared={shared} />
              ))}
            </ol>
          </section>
          {history === null ? null : <TrendSection history={history} shared={shared} />}
          {history === null ? null : <HoldersSection history={history} smart={data.smart} shared={shared} />}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium tracking-tight">{copy.topHeading}</h2>
            <ol className="flex flex-col gap-3">
              {data.smart.slice(0, SMART_POSITIONS_SHOWN).map((position) => (
                <PositionRow key={position.tokenId} position={position} shared={shared} />
              ))}
            </ol>
          </section>
        </>
      )}
      <p className="text-xs text-muted">
        {read.poolsRead < read.poolsAsked
          ? `${copy.poolsRead(formatWhole(read.poolsRead, locale), formatWhole(read.poolsAsked, locale))} `
          : ""}
        {copy.measuredAt(formatUtcMinute(read.measuredAt))}
      </p>
    </>
  );
}
