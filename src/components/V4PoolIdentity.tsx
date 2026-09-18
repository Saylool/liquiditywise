import { formatFeePpm, formatPercent, formatWhole } from "../lib/format/displayFormats";
import { priceStepRatio } from "../lib/format/priceStep";
import { HookPermissions } from "./HookPermissions";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  type DataResult,
  swapFeePpm,
  type V4Pool,
  type V4ProtocolFee,
  ZERO_ADDRESS,
} from "../schemas";

/** The protocol's cut as one figure, or two when it differs by direction. */
const formatProtocolFee = (fee: V4ProtocolFee, locale: Locale): string =>
  fee.zeroForOnePpm === fee.oneForZeroPpm
    ? formatFeePpm(fee.zeroForOnePpm, locale)
    : `${formatFeePpm(fee.zeroForOnePpm, locale)} / ${formatFeePpm(fee.oneForZeroPpm, locale)}`;

/** What a swap pays, likewise: the key's fee and the cut combined per direction. */
const formatSwapFee = (lpFee: number, fee: V4ProtocolFee, locale: Locale): string => {
  const zeroForOne = swapFeePpm(lpFee, fee.zeroForOnePpm);
  const oneForZero = swapFeePpm(lpFee, fee.oneForZeroPpm);

  return zeroForOne === oneForZero
    ? formatFeePpm(zeroForOne, locale)
    : `${formatFeePpm(zeroForOne, locale)} / ${formatFeePpm(oneForZero, locale)}`;
};

/**
 * The fee figure and its note, for the three states a key can be in.
 *
 * Static: the key's fee, and what a swap pays once the protocol's cut is on
 * top. Dynamic: the hook decides, and nothing is shown as current. Unread: the
 * chain did not answer, and nothing stands in — never the indexer's figure.
 */
const feeFigure = (
  pool: V4Pool,
  t: Dictionary,
  locale: Locale,
): { readonly value: string; readonly note: string } => {
  const { fee, protocolFee } = pool;
  if (fee.kind === "dynamic") return { value: t.v4.dynamicFee, note: t.v4.dynamicFeeNote };
  if (fee.kind === "unread") return { value: t.v4.feeUnread, note: t.v4.feeUnreadNote };

  const value = formatFeePpm(fee.feePpm, locale);
  if (protocolFee === null || (protocolFee.zeroForOnePpm === 0 && protocolFee.oneForZeroPpm === 0)) {
    return { value, note: t.v4.feeNoteNoProtocol };
  }

  return {
    value,
    note: t.v4.feeNote(
      formatSwapFee(fee.feePpm, protocolFee, locale),
      value,
      formatProtocolFee(protocolFee, locale),
    ),
  };
};

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
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          {t.v4.heading}
        </h2>
        <p className="text-sm leading-relaxed">{t.v4.unavailableHeading}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </section>
    );
  }

  const pool = result.data;
  const holdsNativeEther =
    pool.token0.address === ZERO_ADDRESS || pool.token1.address === ZERO_ADDRESS;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {pool.token0.symbol} / {pool.token1.symbol}
          </h1>
          <p className="text-sm leading-relaxed text-muted">{t.v4.intro}</p>
        </div>

        <dl className="grid gap-5 sm:grid-cols-2">
          <Figure label={t.v4.poolId} value={pool.id} />
          <Figure label={t.v4.fee} {...feeFigure(pool, t, locale)} />
          {/*
           * The protocol's cut is its own figure, because it is its own fact:
           * governance sets it, the key does not carry it, and it is what turns
           * a 0.05% pool into a 0.0625% swap.
           */}
          {pool.protocolFee === null ? null : (
            <Figure
              label={t.v4.protocolFee}
              value={
                pool.protocolFee.zeroForOnePpm === 0 && pool.protocolFee.oneForZeroPpm === 0
                  ? t.v4.protocolFeeNone
                  : formatProtocolFee(pool.protocolFee, locale)
              }
              note={
                pool.protocolFee.zeroForOnePpm === pool.protocolFee.oneForZeroPpm
                  ? t.v4.protocolFeeNote
                  : `${t.v4.protocolFeeNote} ${t.v4.protocolFeeByDirection(pool.token0.symbol, pool.token1.symbol)}`
              }
            />
          )}
          {/*
           * As a percentage, which is what the spacing means to a person: how
           * finely a position's edges can be placed. The tick count is in the
           * note for the reader who knows what one is.
           */}
          <Figure
            label={t.v4.priceStep}
            value={formatPercent(priceStepRatio(pool.tickSpacing), locale)}
            note={t.v4.priceStepNote(formatWhole(pool.tickSpacing, locale))}
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

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
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
            <HookPermissions hookAddress={pool.hookAddress} t={t} />

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
