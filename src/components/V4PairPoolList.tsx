import Link from "next/link";

import { v4PoolAnalysisHref } from "../lib/advisor/requestedParameters";
import { formatEtherAmount, formatFeePpm, formatWhole } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  alterSwapEconomics,
  type DataResult,
  depthInEth,
  type PriceBandParameters,
  type V4PairPool,
  type V4PairPools,
} from "../schemas";

/**
 * The v4 pools of one pair, as a list.
 *
 * A list rather than a panel, because two panels carry it: the v3 page's
 * "where else this pair trades", where it shows the same two contracts on v4,
 * and the v4 page's, where it shows the pool's siblings with the reader's own
 * pool marked. What differs between them is `current`, and nothing else.
 *
 * Presentational only. The order is depth at the current price — the one v4
 * list here ordered by a chain-read figure rather than a fixed property,
 * because a v4 pair is mostly pools somebody initialised and left, and depth
 * is what tells those apart. The note under the list says so, and says that
 * deeper is not better.
 */

/**
 * How many to show. The same count the search publishes, for the same reason
 * — and the reader's own pool is shown whatever its depth, since a list of
 * siblings that left out the pool being read would be the one list that could
 * not be checked against the page.
 */
export const V4_PAIR_POOLS_SHOWN = 12;

const PoolRow = ({
  entry,
  current,
  parameters,
  t,
  locale,
}: {
  entry: V4PairPool;
  current: boolean;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) => {
  const { pool } = entry;
  const depth = depthInEth(entry);
  const fee = pool.fee.kind === "static" ? formatFeePpm(pool.fee.feePpm, locale) : t.v4.dynamicFee;

  const body = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-base font-medium">
          {fee} · {t.feeTiers.tickSpacing(formatWhole(pool.tickSpacing, locale))}
        </span>
        {current ? (
          <span className="text-xs uppercase tracking-widest text-muted">{t.feeTiers.thisOne}</span>
        ) : (
          <span className="text-xs text-accent">{t.feeTiers.open}</span>
        )}
      </div>
      <p className="text-xs text-muted">
        {depth === null ? (
          t.feeTiers.stateUnread
        ) : (
          <>
            {t.feeTiers.depth}{" "}
            <span className="font-mono">{t.feeTiers.depthValue(formatEtherAmount(depth, locale))}</span>
          </>
        )}
      </p>
      {/* On the row, read from the address bits: a reader should meet the hook here, not on the next page. */}
      <p className="break-all font-mono text-[11px] leading-relaxed text-muted">
        {pool.hookAddress === null
          ? t.feeTiers.noHook
          : `${t.feeTiers.hook} ${pool.hookAddress}${alterSwapEconomics(pool.hookAddress) ? ` · ${t.feeTiers.hookAltersSwaps}` : ""}`}
      </p>
    </>
  );

  return (
    <li>
      {current ? (
        <div className="flex flex-col gap-2 rounded-md border border-accent bg-background p-4">{body}</div>
      ) : (
        <Link
          href={v4PoolAnalysisHref(pool.id, parameters)}
          className="flex flex-col gap-2 rounded-md border border-border bg-background p-4"
        >
          {body}
        </Link>
      )}
    </li>
  );
};

export function V4PairPoolList({
  result,
  pair,
  parameters,
  t,
  locale,
}: {
  result: DataResult<V4PairPools>;
  /** The pair as the page names it, so the two agree. */
  pair: string;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    return (
      <>
        <p className="text-sm leading-relaxed">{t.feeTiers.v4Unavailable}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </>
    );
  }

  const { pools, analysedPoolId } = result.data;
  if (pools.length === 0) {
    return <p className="text-sm leading-relaxed text-muted">{t.feeTiers.v4None(pair)}</p>;
  }
  if (pools.length === 1 && analysedPoolId !== null) {
    return <p className="text-sm leading-relaxed text-muted">{t.feeTiers.v4OnlyThis(pair)}</p>;
  }

  const visible = pools.filter(
    (entry, index) => index < V4_PAIR_POOLS_SHOWN || entry.pool.id === analysedPoolId,
  );
  const remaining = pools.length - visible.length;

  return (
    <>
      <p className="text-sm leading-relaxed text-muted">{t.feeTiers.v4Intro(pair)}</p>
      <ul className="flex flex-col gap-3">
        {visible.map((entry) => (
          <PoolRow
            key={entry.pool.id}
            entry={entry}
            current={entry.pool.id === analysedPoolId}
            parameters={parameters}
            t={t}
            locale={locale}
          />
        ))}
      </ul>
      {remaining > 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          {t.feeTiers.moreNotShown(formatWhole(remaining, locale))}
        </p>
      ) : null}
      <p className="text-xs leading-relaxed text-muted">{t.feeTiers.v4Ordering}</p>
    </>
  );
}
