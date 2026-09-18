import { isFullyTranslated, LOCALE_DETAILS, LOCALES, type Locale } from "../lib/i18n/locales";
import { setLocale } from "../lib/i18n/setLocaleAction";

/**
 * The language picker: a chip that opens a dialog of every published language.
 *
 * **It works without JavaScript**, which is why it is a `<details>` and not a
 * scripted modal. Choosing a language is a form submission — one button per
 * language, the value riding along with the button — so a reader with scripts
 * off gets the same two clicks as everybody else.
 *
 * Closing works without scripts too, and that is what the odd markup below is
 * for. A `<details>` is closed by clicking its own `<summary>`, so the backdrop
 * and the × are both *children of the summary*: clicking either one is clicking
 * the summary. One element, three appearances, decided by whether the dialog is
 * open.
 *
 * The × sits at the corner of the screen rather than of the panel, which is the
 * one place it can be without being measured against a box whose height depends
 * on how many languages there are and how tall the window is. A close control
 * that drifts off its corner on a short window would be worse than one that is
 * simply somewhere else.
 */
export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const chosen = LOCALE_DETAILS[current];

  return (
    <details className="group/lang relative">
      <summary
        aria-label={label}
        className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-muted [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true">{chosen.flag}</span>
        <span className="font-medium text-foreground">{chosen.name}</span>

        {/* Both of these belong to the summary, so clicking either one closes. */}
        <span className="fixed inset-0 z-40 hidden bg-foreground/40 group-open/lang:block" />
        <span
          aria-hidden="true"
          className="fixed end-4 top-4 z-[60] hidden rounded-md px-3 py-2 text-lg leading-none text-muted group-open/lang:block"
        >
          ×
        </span>
      </summary>

      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <form
          action={setLocale}
          className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-raised"
        >
          <p className="border-b border-border px-5 py-4 text-base font-semibold">{label}</p>

          <ul className="flex flex-col overflow-y-auto py-2">
            {LOCALES.map((locale) => {
              const { flag, name } = LOCALE_DETAILS[locale];

              return (
                <li key={locale}>
                  <button
                    type="submit"
                    name="locale"
                    value={locale}
                    aria-current={locale === current ? "true" : undefined}
                    className={`flex w-full items-center gap-3 px-5 py-2.5 text-start text-sm hover:bg-surface-sunken ${
                      locale === current ? "font-semibold text-accent" : "text-foreground"
                    }`}
                  >
                    <span aria-hidden="true" className="text-base">
                      {flag}
                    </span>
                    <span>{name}</span>
                    {/*
                     * Marked here rather than left to be discovered: a reader
                     * choosing a language deserves to know before they choose
                     * that its longer text is still English.
                     */}
                    {isFullyTranslated(locale) ? null : (
                      <span className="ms-auto text-xs font-normal text-subtle">EN</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </form>
      </div>
    </details>
  );
}
