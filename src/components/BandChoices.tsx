import {
  DEPOSIT_CHOICES,
  DEPOSIT_PARAMETER,
  HORIZON_CHOICES,
  HORIZON_PARAMETER,
  MULTIPLIER_CHOICES,
  MULTIPLIER_PARAMETER,
} from "../lib/advisor/requestedParameters";
import { widthWord } from "../lib/advisor/widthWords";
import { formatMultiplier, formatUsd, formatWhole } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PriceBandParameters } from "../schemas";

/*
 * The three selects behind a band — horizon, width, deposit — used by both
 * forms that set one: the form under an analysis, which changes that page, and
 * the preferences in the header, which change what every page opens at.
 *
 * One component rather than two copies, so the two forms cannot drift apart in
 * what they offer or how they label it. The same words sit on the figures in
 * "how this range was drawn", so a reader changing one can see which number
 * they are changing.
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
export const optionsIncluding = (offered: readonly number[], current: number): readonly number[] =>
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
      className="rounded-md border border-border bg-surface-sunken px-3 py-2 font-mono text-sm"
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

export function BandChoices({
  parameters,
  depositUsd,
  t,
  locale,
}: {
  parameters: PriceBandParameters;
  depositUsd: number;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <>
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
      <Choice
        name={DEPOSIT_PARAMETER}
        label={t.parameters.depositLabel}
        current={depositUsd}
        options={optionsIncluding(DEPOSIT_CHOICES, depositUsd)}
        format={(value) => formatUsd(value, locale)}
      />
    </>
  );
}
