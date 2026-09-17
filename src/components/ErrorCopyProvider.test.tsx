import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import { ERROR_COPY } from "../lib/i18n/errorCopy";
import { DEFAULT_LOCALE, LOCALES } from "../lib/i18n/locales";
import { ErrorCopyProvider, useErrorCopy } from "./ErrorCopyProvider";

/** Reads the context the way the error boundary does, and prints one string. */
function Probe() {
  return <span>{useErrorCopy().title}</span>;
}

describe("ErrorCopyProvider", () => {
  /*
   * The failure this guards against is not subtle once it happens and is
   * invisible until it does: `Dictionary` is full of template functions, a
   * function cannot cross from a Server Component to a Client one, and this
   * provider is rendered by the root layout — so one function added here would
   * take down every page in the application rather than the error screen.
   */
  it.each(LOCALES)("carries only strings across the boundary in %s", (locale) => {
    expect(Object.values(ERROR_COPY[locale]).every((value) => typeof value === "string")).toBe(
      true,
    );
  });

  it("is the same object the dictionary serves", () => {
    for (const locale of LOCALES) {
      expect(getDictionary(locale).error).toBe(ERROR_COPY[locale]);
    }
  });

  it("hands the boundary the language it was given", () => {
    const markup = renderToStaticMarkup(
      <ErrorCopyProvider copy={ERROR_COPY.tr}>
        <Probe />
      </ErrorCopyProvider>,
    );

    expect(markup).toContain(ERROR_COPY.tr.title);
    expect(markup).not.toContain(ERROR_COPY.en.title);
  });

  /*
   * Unreachable through the application — the root layout renders a provider
   * around every route — and defined rather than left as `null` so that the
   * boundary has no branch for a case nothing can produce.
   */
  it("falls back to the default language with no provider above it", () => {
    expect(renderToStaticMarkup(<Probe />)).toContain(ERROR_COPY[DEFAULT_LOCALE].title);
  });
});
