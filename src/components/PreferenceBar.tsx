import type { Dictionary } from "../lib/i18n/dictionaries";
import { isFullyTranslated, type Locale } from "../lib/i18n/locales";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";

/** Language and theme controls, shown on every page. */
export function PreferenceBar({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <div className="preferences">
      {/*
       * Shown while a language is still being translated, and shown in that
       * language. A reader who is told can decide what to do about it; a reader
       * who finds out halfway down a paragraph has already been misled.
       */}
      {isFullyTranslated(locale) ? null : (
        <p className="text-xs leading-relaxed text-subtle">{t.preferences.partlyTranslated}</p>
      )}
      <div className="preference-controls">
        <LocaleSwitcher key={locale} current={locale} label={t.preferences.selectLanguage} />
        <ThemeToggle
          label={t.preferences.themeLabel}
          optionLabels={{
            system: t.preferences.themeSystem,
            light: t.preferences.themeLight,
            dark: t.preferences.themeDark,
          }}
        />
      </div>
    </div>
  );
}
