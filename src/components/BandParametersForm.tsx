import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PriceBandParameters } from "../schemas";
import { BandChoices } from "./BandChoices";

/**
 * The knobs behind the price band, and the size the fees are shared out for.
 *
 * Until this existed every visitor saw the same analysis — thirty days, one
 * standard deviation — and the pipeline had taken both as parameters the whole
 * time. Exposing them is what turns one reading into something a person can ask
 * questions of: what if I want a tighter range, what if I am thinking a week
 * ahead.
 *
 * A plain GET form that resubmits the pool address alongside them, so a chosen
 * band lives in the URL like everything else here: linkable, reloadable, and
 * comparable by opening two of them.
 *
 * It changes this page. What every page opens at is the reader's preference,
 * set in the header, and the line under the form says so — a reader who has
 * set one and still sees this form should know which of the two they are
 * touching.
 */
export function BandParametersForm({
  action,
  poolParameter,
  poolId,
  parameters,
  depositUsd,
  fellBack,
  t,
  locale,
}: {
  /**
   * Where the form submits, and under what name the pool travels.
   *
   * Both are props rather than constants because the two analysis pages address
   * a pool differently — `/pool?address=` takes a contract, `/v4?id=` takes a
   * 32-byte PoolId — and a second copy of this form would be a second place for
   * the horizon and the multiplier to drift apart.
   */
  action: string;
  poolParameter: string;
  poolId: string;
  parameters: PriceBandParameters;
  /**
   * The deposit the fee share is worked out for.
   *
   * Beside the band rather than in it, here as everywhere else: it changes no
   * figure the band produces, and sits in this form only because this is where a
   * reader already is when they want to change what they are being told about.
   */
  depositUsd: number;
  /** True when something was asked for and could not be used. */
  fellBack: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <form
      method="get"
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card"
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.parameters.heading}
      </h2>

      {/* The pool is not being changed here, so it travels hidden. */}
      <input type="hidden" name={poolParameter} value={poolId} />

      <div className="flex flex-wrap items-end gap-4">
        <BandChoices parameters={parameters} depositUsd={depositUsd} t={t} locale={locale} />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on transition-[filter] hover:brightness-110"
        >
          {t.parameters.apply}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-muted">{t.parameters.note}</p>
      <p className="text-xs leading-relaxed text-subtle">{t.parameters.preferenceHint}</p>
      {fellBack ? (
        <p className="text-sm leading-relaxed text-muted">{t.parameters.fellBack}</p>
      ) : null}
    </form>
  );
}
