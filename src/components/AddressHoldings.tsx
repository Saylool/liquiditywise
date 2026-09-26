
import { GuardedLink } from "./GuardedLink";
import { poolAnalysisHref, v4PoolAnalysisHref } from "../lib/advisor/requestedParameters";
import { formatFeePpm, formatTokenAmount, formatWhole } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  type AddressHoldings as Holdings,
  type DataResult,
  type HoldingPool,
  ONE_SIDED_SHOWN,
  type PriceBandParameters,
} from "../schemas";
import { chainLabel } from "../lib/chains/chainLabel";
import { chainOf } from "../lib/chains/chains";

/**
 * What an address holds, and the pools that opens.
 *
 * Presentational only. Two things about it are deliberate:
 *
 *   - **The width of the search is part of the answer, not a footnote.** Nothing
 *     can list an address's tokens, so "nothing found" means "none of the ones
 *     asked", and a page that let that read as "your wallet is empty" would be
 *     answering a question it never asked.
 *   - **Holding both sides comes first, and that is the only ordering claim.**
 *     It is about the reader — a pool you already hold both sides of needs no
 *     swap first — and not about which pool is worth anything. The paragraph at
 *     the end says so in as many words.
 *   - **The one-sided list is cut, and the cut is stated.** Holding WETH puts
 *     two hundred pools within a swap, which is true and is not a page anybody
 *     can read. What is shown is the most-traded of them, in the order the
 *     source reports — a second ordering claim, and one that has to be made out
 *     loud rather than left to be inferred from a list that stops.
 */

/**
 * One pool, of either protocol, linked to its own analysis.
 *
 * The protocol is on the row because the two are not interchangeable for a
 * holder: a v3 pool wants wrapped ether where a v4 one may take the chain's
 * own, and a v4 pool may carry a hook. The row says "hook" when one is there
 * and leaves the rest to the pool's page, which prints what it may do.
 */
const TierRow = ({
  entry,
  parameters,
  t,
  locale,
}: {
  entry: HoldingPool;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) => {
  const { pool } = entry;
  const href =
    pool.protocolVersion === "v3"
      ? poolAnalysisHref(pool.id, parameters, undefined, chainOf(pool.chainId))
      : v4PoolAnalysisHref(pool.id, parameters, undefined, chainOf(pool.chainId));
  const fee =
    pool.protocolVersion === "v3"
      ? formatFeePpm(pool.feePpm, locale)
      : pool.fee.kind === "static"
        ? formatFeePpm(pool.fee.feePpm, locale)
        : pool.fee.kind === "dynamic"
          ? t.v4.dynamicFee
          : t.v4.feeUnread;
  const hooked = pool.protocolVersion === "v4" && pool.hookAddress !== null;

  return (
    <li>
      <GuardedLink
        href={href}
        className="flex flex-col gap-2 rounded-md border border-border bg-surface-sunken p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-base font-medium">
            {pool.token0.symbol} / {pool.token1.symbol}
          </span>
          <span className="font-mono text-xs text-muted">
            {pool.protocolVersion} · {fee}
            {hooked ? ` · ${t.holdings.hookTag}` : ""}
          </span>
        </div>
        <p className="text-xs text-accent">{t.holdings.analyse}</p>
      </GuardedLink>
    </li>
  );
};

const PoolGroup = ({
  entries,
  title,
  note,
  shown,
  parameters,
  t,
  locale,
}: {
  entries: readonly HoldingPool[];
  title: string;
  note: string;
  /** How many to render. The rest are counted in a sentence, not hidden. */
  shown?: number;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) => {
  const visible = shown === undefined ? entries : entries.slice(0, shown);
  const remaining = entries.length - visible.length;

  return entries.length === 0 ? null : (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs uppercase tracking-widest text-muted">
        {title} · {formatWhole(entries.length, locale)}
      </h3>
      <p className="text-xs leading-relaxed text-muted">{note}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((entry) => (
          <TierRow
            key={entry.pool.id}
            entry={entry}
            parameters={parameters}
            t={t}
            locale={locale}
          />
        ))}
      </ul>
      {remaining > 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          {t.holdings.moreNotShown(formatWhole(remaining, locale))}
        </p>
      ) : null}
    </div>
  );
};

export function AddressHoldings({
  result,
  parameters,
  chainId = 1,
  t,
  locale,
}: {
  result: DataResult<Holdings>;
  /** The chain the address was read on; v4 is read on mainnet alone. */
  chainId?: number;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          {t.holdings.heading}
        </h2>
        <p className="text-sm leading-relaxed">{t.holdings.unavailableHeading}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </section>
    );
  }

  const { holdings, pools, tokensChecked, poolsSearched } = result.data;
  const both = pools.filter((entry) => entry.heldSides === "both");
  const one = pools.filter((entry) => entry.heldSides !== "both");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          {t.holdings.heading}
        </h2>
        <p className="text-sm leading-relaxed">{t.holdings.intro}</p>

        <p className="text-xs uppercase tracking-widest text-muted">{t.holdings.forAddress}</p>
        {/* In full, like every address here: a truncated one tells you nothing. */}
        <p className="break-all font-mono text-sm">{result.data.address}</p>

        <h3 className="pt-2 text-xs uppercase tracking-widest text-muted">
          {t.holdings.holdingsHeading}
        </h3>
        {holdings.length === 0 ? (
          <p className="text-sm leading-relaxed">{t.holdings.nothingFound}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {holdings.map((holding) => (
              <li
                key={holding.token.address}
                className="flex justify-between gap-4 font-mono text-sm"
              >
                <span>{holding.token.symbol}</span>
                <span>{formatTokenAmount(holding.amount, holding.token.decimals, locale)}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
          {t.holdings.howItLooked(
            formatWhole(tokensChecked, locale),
            formatWhole(poolsSearched.v3 ?? 0, locale),
            poolsSearched.v4 === null ? null : formatWhole(poolsSearched.v4, locale),
            chainLabel(chainId, locale),
          )}
        </p>
        {/* Said out loud, so a v3-only list cannot read as "no v4 pool takes this". */}
        {/* Off mainnet no v4 is read at all, which is not the net failing to be cast. */}
        {poolsSearched.v4 === null && chainId === 1 ? (
          <p className="text-xs leading-relaxed text-muted">{t.holdings.v4NotSearched}</p>
        ) : null}
      </section>

      {pools.length === 0 ? null : (
        <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
            {t.holdings.poolsHeading}
          </h2>

          <PoolGroup
            entries={both}
            title={t.holdings.bothSides}
            note={t.holdings.bothSidesNote}
            parameters={parameters}
            t={t}
            locale={locale}
          />
          <PoolGroup
            entries={one}
            title={t.holdings.oneSide}
            note={t.holdings.oneSideNote}
            shown={ONE_SIDED_SHOWN}
            parameters={parameters}
            t={t}
            locale={locale}
          />

          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
            {t.holdings.notAdvice}
          </p>
        </section>
      )}
    </div>
  );
}
