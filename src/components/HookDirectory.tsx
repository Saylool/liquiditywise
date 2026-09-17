import type { HookDirectoryResult } from "../lib/advisor/hookDirectory";
import { v4PoolAnalysisHref } from "../lib/advisor/requestedParameters";
import { formatPercent, formatWhole } from "../lib/format/displayFormats";
import { priceStepRatio } from "../lib/format/priceStep";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PriceBandParameters } from "../schemas";
import { GuardedLink } from "./GuardedLink";
import { HookPermissions } from "./HookPermissions";

/**
 * Every hook the week's busiest v4 pools name, and what each may do.
 *
 * The permissions come from the same component the single-pool page uses, on
 * the same fourteen bits of the same address, so the two cannot describe one
 * hook differently.
 *
 * Each entry leads with the address rather than a name, because there is no
 * name: nothing on chain gives a hook one, and a label from anywhere else would
 * be a claim this application cannot check.
 */
export function HookDirectory({
  result,
  parameters,
  t,
  locale,
}: {
  result: HookDirectoryResult;
  /**
   * The band a pool link carries. A prop rather than an import, because a
   * component that reached into the analysis pipeline for a default would pull
   * the whole of it into every page that renders this one.
   */
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <p className="text-sm leading-relaxed">{t.hooks.unavailable}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </section>
    );
  }

  const { hooks, poolsConsidered, hooklessPools } = result.data;
  const whole = (value: number) => formatWhole(value, locale);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <p className="text-sm leading-relaxed">{t.hooks.intro}</p>
        <p className="text-sm leading-relaxed">{t.hooks.onlyPermissions}</p>
        <p className="text-sm leading-relaxed text-muted">
          {t.hooks.window(
            whole(poolsConsidered),
            whole(poolsConsidered - hooklessPools),
            whole(hooklessPools),
          )}
        </p>
        <p className="text-xs leading-relaxed text-muted">{t.hooks.ordering}</p>
      </section>

      {hooks.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm leading-relaxed">{t.hooks.none}</p>
        </section>
      ) : (
        hooks.map((entry) => (
          <section
            key={entry.address}
            className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
          >
            <div className="flex flex-col gap-1">
              <p className="break-all font-mono text-sm">{entry.address}</p>
              <p className="text-xs uppercase tracking-widest text-muted">
                {t.hooks.runs(whole(entry.poolCount))}
              </p>
            </div>

            <HookPermissions hookAddress={entry.address} t={t} />

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <h3 className="text-xs uppercase tracking-widest text-muted">
                {t.hooks.poolsHeading}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {entry.pools.map((pool) => (
                  <li key={pool.id}>
                    {/*
                     * The price step beside the pair, because one hook on one
                     * pair is routinely several pools and the symbols alone
                     * make them look like the same link twice. The fee would
                     * separate them better and is not available: this list
                     * carries every fee unread on purpose — a v4 pool's real
                     * fee comes from the chain, and two hundred and fifty of
                     * them is more than the endpoint answers for.
                     */}
                    <GuardedLink
                      href={v4PoolAnalysisHref(pool.id, parameters)}
                      className="block rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs"
                    >
                      {pool.token0.symbol} / {pool.token1.symbol} ·{" "}
                      {t.feeTiers.priceStep(formatPercent(priceStepRatio(pool.tickSpacing), locale))}
                    </GuardedLink>
                  </li>
                ))}
                {entry.poolCount <= entry.pools.length ? null : (
                  <li className="px-1 py-1.5 text-xs text-muted">
                    {t.hooks.moreNotShown(whole(entry.poolCount - entry.pools.length))}
                  </li>
                )}
              </ul>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
