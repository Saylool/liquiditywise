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
import { choosePriceQuote } from "../lib/format/priceQuote";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { SmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import type { PriceBandParameters, V3PoolMetadata } from "../schemas";
import { ChainTabs } from "./ChainTabs";
import { GuardedLink } from "./GuardedLink";

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
): { readonly below: number; readonly above: number } =>
  choosePriceQuote({ token0: pool.token0, token1: pool.token1 }, currentPrice).inverted
    ? { below: 1 / upperRatio - 1, above: 1 / lowerRatio - 1 }
    : { below: lowerRatio - 1, above: upperRatio - 1 };

const signed = (ratio: number, locale: Locale): string => `${ratio > 0 ? "+" : ""}${formatPercent(ratio, locale)}`;

const rangeText = (range: { below: number; above: number }, { copy, locale }: Shared): string =>
  copy.rangeValue(signed(range.below, locale), signed(range.above, locale));

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

export function SmartLiquidity({
  read,
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
