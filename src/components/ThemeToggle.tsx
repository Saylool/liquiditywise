"use client";

import { useSyncExternalStore } from "react";

import { THEMES, type Theme } from "../lib/theme/theme";
import {
  chooseTheme,
  readServerTheme,
  readTheme,
  subscribeToTheme,
} from "../lib/theme/themeStore";

/*
 * The application's only Client Component.
 *
 * It exists because switching theme must not reach the server: re-rendering the
 * pool page means reading a subgraph and making an `eth_call`, so a
 * server-driven toggle would spend API quota and a rate-limit slot to change a
 * colour. Everything else here stays server-rendered.
 *
 * The stored choice is an external store, so it is read through
 * `useSyncExternalStore` rather than copied into state inside an effect. That is
 * what makes server and browser agree on the first frame — the server renders
 * the default, React re-renders with the real value straight after hydration —
 * and it also means a change made in one tab follows into every other.
 *
 * None of this is what stops the page flashing. The theme is already on the
 * document before anything paints, applied by the boot script in the layout;
 * this component only keeps the control's own state honest.
 */

export function ThemeToggle({
  label,
  optionLabels,
}: {
  label: string;
  optionLabels: Record<Theme, string>;
}) {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, readServerTheme);

  return (
    <div className="theme-toggle">
      <div role="group" aria-label={label} className="theme-options">
        {THEMES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              chooseTheme(option, document.documentElement);
            }}
            aria-pressed={theme === option}
            aria-label={optionLabels[option]}
            title={optionLabels[option]}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {option === "system" ? <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></> : option === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 14a9 9 0 0 1-10.5-10.5A9 9 0 1 0 20.5 14Z" />}
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
