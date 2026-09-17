import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ErrorCopyProvider } from "../components/ErrorCopyProvider";
import { ERROR_COPY } from "../lib/i18n/errorCopy";
import type { Locale } from "../lib/i18n/locales";
import Error from "./error";

/*
 * The boundary, which does two things: it reads the language out of the context
 * the layout put it in, and it passes the framework's hash on. What the screen
 * it renders actually says is checked next to that screen.
 */
const SECRET = "connect ECONNREFUSED 10.0.0.4:5432";

const render = (locale: Locale = "en", digest?: string) =>
  renderToStaticMarkup(
    <ErrorCopyProvider copy={ERROR_COPY[locale]}>
      <Error
        error={Object.assign(new globalThis.Error(SECRET), digest === undefined ? {} : { digest })}
        retry={() => undefined}
      />
    </ErrorCopyProvider>,
  );

describe("the error boundary", () => {
  it("renders in the language the layout resolved", () => {
    expect(render("tr")).toContain(ERROR_COPY.tr.title);
    expect(render("tr")).not.toContain(ERROR_COPY.en.title);
    expect(render("en")).toContain(ERROR_COPY.en.title);
  });

  it("passes the framework's identifier through", () => {
    expect(render("en", "9f2c1a")).toContain("9f2c1a");
    expect(render()).not.toContain(ERROR_COPY.en.referenceLabel);
  });

  /*
   * The framework replaces a server error's message before it reaches the
   * browser. This boundary never hands one on in the first place, so nothing
   * thrown in development leaks either — a message can carry a host, a port or a
   * query.
   */
  it("never passes on what the error was carrying", () => {
    expect(render()).not.toContain(SECRET);
    expect(render("en", "9f2c1a")).not.toContain(SECRET);
  });
});
