import {
  HORIZON_CHOICES,
  HORIZON_PARAMETER,
  MULTIPLIER_CHOICES,
  MULTIPLIER_PARAMETER,
} from "../lib/advisor/requestedParameters";
import { widthWord } from "../lib/advisor/widthWords";
import { formatMultiplier, formatWhole } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PriceBandParameters } from "../schemas";

/**
 * The two knobs behind the price band.
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
 * Labelled in the reader's terms — how far ahead, how wide — and the same
 * labels sit on the figures in "how this range was drawn", so a reader
 * changing one can see which number they are changing.
 */

/**
 * The offered values, plus whatever is currently in effect if it is not one of
 * them.
 *
 * Without that last part a select would show the first option while the page
 * showed a different band — and submitting it would quietly change a setting
 * nobody touched. The schema accepts more than the interface offers, so this
 * case is reachable by typing a URL, which is allowed.
 */
const optionsIncluding = (offered: readonly number[], current: number): readonly number[] =>
  offered.includes(current) ? offered : [...offered, current].sort((a, b) => a - b);

const Choice = ({
  name,
  label,
  current,
  options,
  format,
}: {
  name: string;
  label: string;
  current: number;
  options: readonly number[];
  format: (value: number) => string;
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
    <select
      name={name}
      defaultValue={String(current)}
      className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
    >
      {options.map((value) => (
        /* The value is the number as a URL writes it; only the label is localised. */
        <option key={value} value={String(value)}>
          {format(value)}
        </option>
      ))}
    </select>
  </label>
);

export function BandParametersForm({
  action,
  poolParameter,
  poolId,
  parameters,
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
  /** True when something was asked for and could not be used. */
  fellBack: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <form
      method="get"
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.parameters.heading}
      </h2>

      {/* The pool is not being changed here, so it travels hidden. */}
      <input type="hidden" name={poolParameter} value={poolId} />

      <div className="flex flex-wrap items-end gap-4">
        <Choice
          name={HORIZON_PARAMETER}
          label={t.parameters.horizonLabel}
          current={parameters.horizonDays}
          options={optionsIncluding(HORIZON_CHOICES, parameters.horizonDays)}
          format={(value) => t.parameters.days(formatWhole(value, locale))}
        />
        <Choice
          name={MULTIPLIER_PARAMETER}
          label={t.parameters.widthLabel}
          current={parameters.standardDeviationMultiplier}
          options={optionsIncluding(MULTIPLIER_CHOICES, parameters.standardDeviationMultiplier)}
          format={(value) =>
            t.parameters.widthChoice(
              t.parameters.sigma(formatMultiplier(value, locale)),
              widthWord(value, t),
            )
          }
        />
        <button
          type="submit"
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium"
        >
          {t.parameters.apply}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-muted">{t.parameters.note}</p>
      {fellBack ? (
        <p className="text-sm leading-relaxed text-muted">{t.parameters.fellBack}</p>
      ) : null}
    </form>
  );
}
