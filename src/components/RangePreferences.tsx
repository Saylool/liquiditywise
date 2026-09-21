import { RESET_FIELD } from "../lib/advisor/rangePreferences";
import type { RangeDefaults } from "../lib/advisor/requestedParameters";
import { setRangePreferences } from "../lib/advisor/setRangePreferencesAction";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { BandChoices } from "./BandChoices";

/**
 * The band every pool opens at, chosen once.
 *
 * The same `<details>` dialog as the language picker, for the same reason: it
 * works with scripts off. Saving is a form submission to a Server Action that
 * writes one cookie; forgetting is the same form with a second button. The
 * backdrop and the × are children of the summary, so clicking either closes.
 *
 * Shows what is in effect right now — the preference if one is set, the
 * application's defaults otherwise — because a dialog that opened on the
 * first option while the pages used another would be lying about what saving
 * would change.
 */
export function RangePreferences({
  current,
  hasPreference,
  t,
  locale,
}: {
  current: RangeDefaults;
  /** Whether the reader has set one, which decides whether there is anything to forget. */
  hasPreference: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <details className="group/range relative">
      <summary aria-label={t.preferences.rangeLabel} title={t.preferences.rangeLabel} className="locale-trigger">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="2" fill="var(--surface)" />
          <circle cx="15" cy="12" r="2" fill="var(--surface)" />
          <circle cx="7" cy="18" r="2" fill="var(--surface)" />
        </svg>

        {/* Both of these belong to the summary, so clicking either one closes. */}
        <span className="fixed inset-0 z-40 hidden bg-foreground/40 group-open/range:block" />
        <span
          aria-hidden="true"
          className="fixed end-4 top-4 z-[60] hidden rounded-md px-3 py-2 text-lg leading-none text-muted group-open/range:block"
        >
          ×
        </span>
      </summary>

      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <form
          action={setRangePreferences}
          className="flex max-h-[80vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-raised"
        >
          <p className="text-base font-semibold">{t.preferences.rangeLabel}</p>
          <p className="text-sm leading-relaxed text-muted">{t.preferences.rangeIntro}</p>

          <div className="flex flex-wrap items-end gap-4">
            <BandChoices
              parameters={current.parameters}
              depositUsd={current.depositUsd}
              t={t}
              locale={locale}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on transition-[filter] hover:brightness-110"
            >
              {t.preferences.rangeSave}
            </button>
            {hasPreference ? (
              <button
                type="submit"
                name={RESET_FIELD}
                value="1"
                className="rounded-md border border-border px-4 py-2 text-sm text-muted hover:bg-surface-sunken"
              >
                {t.preferences.rangeReset}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </details>
  );
}
