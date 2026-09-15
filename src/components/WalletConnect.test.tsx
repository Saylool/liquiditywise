import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { WalletConnect } from "./WalletConnect";

const render = (locale: Locale = "en") =>
  renderToStaticMarkup(<WalletConnect strings={getDictionary(locale).wallet} />);

describe("WalletConnect", () => {
  /*
   * It takes `t.wallet` and not `t`, because `Dictionary` holds functions and a
   * function cannot cross from a Server Component to a Client one. Passing the
   * whole dictionary renders the landing page as a server error that names no
   * property, which is how this was found.
   */
  it("is given only strings, so it can cross the server boundary", () => {
    const wallet = getDictionary("en").wallet;
    const values = [...Object.values(wallet), ...Object.values(wallet.notices)];

    expect(values.every((value) => typeof value !== "function")).toBe(true);
  });

  /*
   * The server has no window, so the first frame must be the same one the
   * browser renders before it has looked for a wallet. Anything else is a
   * hydration mismatch on the only page every visitor sees.
   */
  it("renders the unconnected state on the server", () => {
    const markup = render();

    expect(markup).toContain("Connect wallet");
    expect(markup).not.toContain("Connected as");
  });

  it("says what the wallet is asked for, and what it is not", () => {
    const markup = render();

    expect(markup).toContain("asks a wallet for its address and never for a signature");
    expect(markup).toContain("sign a message or send a transaction");
  });

  it("says the same in Turkish", () => {
    const markup = render("tr");

    expect(markup).toContain("Cüzdanı bağla");
    expect(markup).toContain("imza istemez");
  });
});
