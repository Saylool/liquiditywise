import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ERROR_COPY } from "../lib/i18n/errorCopy";
import { LOCALES } from "../lib/i18n/locales";
import { findElement } from "../lib/testing/reactTree";
import GlobalError from "./global-error";

const render = () =>
  renderToStaticMarkup(
    <GlobalError error={new globalThis.Error("boom")} retry={() => undefined} />,
  );

describe("the global error screen", () => {
  /*
   * It replaces the root layout rather than rendering inside it, so the document
   * is its own to write. Without these tags the browser is handed fragments.
   */
  it("writes its own document", () => {
    const markup = render();

    expect(markup).toContain("<html");
    expect(markup).toContain("<body");
    expect(markup).toContain("<title>");
  });

  /*
   * There is nothing left to ask which language the reader came for: no request,
   * no cookie the client has read yet, and no `lang` from a layout that threw.
   * Guessing has no second chance here, so both are shown.
   */
  it.each(LOCALES)("speaks %s, because it cannot know which is wanted", (locale) => {
    const markup = render();

    expect(markup).toContain(ERROR_COPY[locale].globalTitle);
    expect(markup).toContain(ERROR_COPY[locale].globalBody);
    expect(markup).toContain(`lang="${locale}"`);
  });

  it("styles itself, because no stylesheet is loaded at this point", () => {
    const markup = render();

    expect(markup).toContain("style=");
    /* The application's classes would name rules nothing has defined. */
    expect(markup).not.toContain("text-muted");
  });

  it("offers the retry in both languages on one control", () => {
    const markup = render();

    expect(markup).toContain(`${ERROR_COPY.en.retry} · ${ERROR_COPY.tr.retry}`);
  });

  /* Markup cannot show a button wired to nothing; calling the component can. */
  it("wires that control to the retry the framework passed", () => {
    const retry = vi.fn();
    const button = findElement(
      GlobalError({ error: new globalThis.Error("boom"), retry }),
      "button",
    );

    expect(typeof button?.onClick).toBe("function");
    (button?.onClick as () => void)();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
