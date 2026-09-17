import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ERROR_COPY } from "../lib/i18n/errorCopy";
import type { Locale } from "../lib/i18n/locales";
import { findElement } from "../lib/testing/reactTree";
import { ErrorScreen } from "./ErrorScreen";

const render = (locale: Locale = "en", digest: string | null = null) =>
  renderToStaticMarkup(
    <ErrorScreen copy={ERROR_COPY[locale]} digest={digest} onRetry={() => undefined} />,
  );

describe("ErrorScreen", () => {
  it("says what happened, that it is worth retrying, and that nothing was kept", () => {
    const markup = render();

    expect(markup).toContain(ERROR_COPY.en.title);
    expect(markup).toContain(ERROR_COPY.en.body);
    expect(markup).toContain(ERROR_COPY.en.nothingKept);
  });

  it("says the same in Turkish", () => {
    const markup = render("tr");

    expect(markup).toContain(ERROR_COPY.tr.title);
    expect(markup).toContain(ERROR_COPY.tr.nothingKept);
    expect(markup).not.toContain(ERROR_COPY.en.title);
  });

  it("offers a retry that is a button and a way back that is a link", () => {
    const markup = render();

    expect(markup).toContain(`<button type="button" class=`);
    expect(markup).toContain(ERROR_COPY.en.retry);
    expect(markup).toContain(`href="/"`);
    expect(markup).toContain(ERROR_COPY.en.home);
  });

  /*
   * The one thing markup cannot show: a button that looks right and does
   * nothing. The screen takes no hooks precisely so this can be checked by
   * calling it.
   */
  it("wires that button to the retry it was given", () => {
    const onRetry = vi.fn();
    const button = findElement(
      ErrorScreen({ copy: ERROR_COPY.en, digest: null, onRetry }),
      "button",
    );

    expect(button).not.toBeNull();
    expect(typeof button?.onClick).toBe("function");
    (button?.onClick as () => void)();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /*
   * Asserted on a fragment rather than the whole sentence: React escapes the
   * apostrophe in "server's", so comparing the copy verbatim would fail when the
   * note renders and — worse — pass when it does not.
   */
  it("shows the identifier when the framework produced one", () => {
    const markup = render("en", "9f2c1a");

    expect(markup).toContain("9f2c1a");
    expect(markup).toContain(ERROR_COPY.en.referenceLabel);
    expect(markup).toContain("It says nothing about you.");
  });

  it("says nothing about an identifier when there is none", () => {
    const markup = render();

    expect(markup).not.toContain(ERROR_COPY.en.referenceLabel);
    expect(markup).not.toContain("It says nothing about you.");
  });
});
