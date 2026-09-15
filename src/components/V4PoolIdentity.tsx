import { formatFeePpm, formatWhole } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  alterSwapEconomics,
  type DataResult,
  hookPermissionsOf,
  type V4Pool,
  ZERO_ADDRESS,
} from "../schemas";

/**
 * What a v4 pool is, and what its hook is permitted to do.
 *
 * Presentational only. The page exists for the second half: a v4 pool's hook can
 * change what a swap costs and what it pays, and no figure drawn from a price
 * series would show it. What *can* be said without trusting anybody is what the
 * protocol will let the hook do, because that is fixed in the hook's own address
 * — so that is what this shows, and it says so in as many words rather than
 * leaving a reader to assume the list describes behaviour.
 */

const Figure = ({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) => (
  <div className="flex flex-col gap-1">
    <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
    <dd className="font-mono text-sm break-all">{value}</dd>
    {note === undefined ? null : <p className="text-xs leading-relaxed text-muted">{note}</p>}
  </div>
);

export function V4PoolIdentity({
  result,
  t,
  locale,
}: {
  result: DataResult<V4Pool>;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          {t.v4.heading}
        </h2>
        <p className="text-sm leading-relaxed">{t.v4.unavailableHeading}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </section>
    );
  }

  const pool = result.data;
  const permissions = hookPermissionsOf(pool.hookAddress);
  const holdsNativeEther =
    pool.token0.address === ZERO_ADDRESS || pool.token1.address === ZERO_ADDRESS;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {pool.token0.symbol} / {pool.token1.symbol}
          </h1>
          <p className="text-sm leading-relaxed text-muted">{t.v4.intro}</p>
        </div>

        <dl className="grid gap-5 sm:grid-cols-2">
          <Figure label={t.v4.poolId} value={pool.id} />
          <Figure
            label={t.v4.fee}
            value={
              pool.fee.kind === "dynamic"
                ? t.v4.dynamicFee
                : formatFeePpm(pool.fee.feePpm, locale)
            }
            {...(pool.fee.kind === "dynamic" ? { note: t.v4.dynamicFeeNote } : {})}
          />
          <Figure
            label={t.v4.tickSpacing}
            value={formatWhole(pool.tickSpacing, locale)}
            note={t.v4.tickSpacingNote}
          />
          {holdsNativeEther ? (
            <Figure
              label={t.v4.nativeCurrency}
              value={ZERO_ADDRESS}
              note={t.v4.nativeCurrencyNote}
            />
          ) : null}
        </dl>

        {/* In full, like every address here. */}
        <div className="flex flex-col gap-0.5 border-t border-border pt-3 font-mono text-[11px] leading-relaxed text-muted">
          <span className="break-all">
            {pool.token0.symbol} {pool.token0.address}
          </span>
          <span className="break-all">
            {pool.token1.symbol} {pool.token1.address}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          {t.v4.hookHeading}
        </h2>

        {pool.hookAddress === null ? (
          <>
            <p className="text-sm leading-relaxed">{t.v4.noHook}</p>
            <p className="text-sm leading-relaxed text-muted">{t.v4.noHookNote}</p>
          </>
        ) : (
          <>
            <p className="break-all font-mono text-sm">{pool.hookAddress}</p>

            {/*
             * The warning goes above the list, not below it: a reader who stops
             * reading should stop having read the part that changes what every
             * other figure means.
             */}
            {alterSwapEconomics(pool.hookAddress) ? (
              <p className="rounded-md border border-warning-border bg-warning-surface px-4 py-3 text-sm leading-relaxed text-warning-foreground">
                {t.v4.alterSwapWarning}
              </p>
            ) : null}

            <h3 className="text-xs uppercase tracking-widest text-muted">{t.v4.hookMay}</h3>
            <ul className="flex flex-col gap-1 font-mono text-sm">
              {permissions.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>

            <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
              {t.v4.hookAddressIsThePermission}
            </p>
          </>
        )}
      </section>

      <p className="text-sm leading-relaxed text-muted">{t.v4.analysisScope}</p>
    </div>
  );
}
