"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "../lib/i18n/dictionaries";
import {
  readFirstAccount,
  readInjectedProvider,
  requestAccount,
  type WalletNotice,
} from "../lib/wallet/eip1193";

/*
 * Asks the browser wallet who it is, and nothing else.
 *
 * The second Client Component in the application, and it is one for the only
 * reason that would justify it: `window.ethereum` exists in a browser and
 * nowhere else. Everything downstream of the address — reading what it holds,
 * finding pools for those tokens — happens on the server, where the reads are
 * verified.
 *
 * **It cannot sign and cannot send.** The module behind it issues exactly one
 * wallet method, `eth_requestAccounts`, and a test asserts that nothing in this
 * path ever asks for a signature or a transaction. That is a narrower promise
 * than the page used to make and it is the one still worth making.
 *
 * The address travels onward in a URL rather than in state, like every other
 * thing this application knows: a page for one address can be linked, reloaded
 * and gone back to, and nothing is stored between visits.
 *
 * It takes its own slice of the dictionary rather than the whole of it, and that
 * is a hard requirement rather than tidiness: `Dictionary` holds functions —
 * `t.parameters.days(…)` and the rest — and a function cannot cross from a
 * Server Component to a Client one. Passing `t` renders the page as a server
 * error with no hint about which property caused it. `t.wallet` is strings all
 * the way down, so it crosses.
 */

type Connection =
  | { readonly state: "idle" }
  | { readonly state: "connecting" }
  | { readonly state: "connected"; readonly address: string }
  | { readonly state: "unavailable"; readonly notice: WalletNotice };

export function WalletConnect({ strings }: { strings: Dictionary["wallet"] }) {
  const [connection, setConnection] = useState<Connection>({ state: "idle" });

  /*
   * Whether a wallet exists is never rendered, only acted on — so it is looked
   * up when the button is pressed rather than held in state. That keeps the
   * server's frame and the browser's first frame identical without a store, and
   * it is the better behaviour besides: someone without a wallet is told so when
   * they ask, rather than greeted with it.
   */
  useEffect(() => {
    const provider = readInjectedProvider();
    if (provider?.on === undefined || provider.removeListener === undefined) return;

    /*
     * A wallet can change account without the page asking. Following it matters
     * because the address on screen is the one a reader is about to act on.
     */
    const handleAccountsChanged = (payload: unknown) => {
      const address = readFirstAccount(payload);
      setConnection(
        address === null
          ? { state: "unavailable", notice: "wallet-no-account" }
          : { state: "connected", address },
      );
    };

    provider.on("accountsChanged", handleAccountsChanged);

    return () => provider.removeListener?.("accountsChanged", handleAccountsChanged);
  }, []);

  const connect = async () => {
    const available = readInjectedProvider();
    if (available === null) {
      setConnection({ state: "unavailable", notice: "wallet-not-found" });
      return;
    }

    setConnection({ state: "connecting" });
    const result = await requestAccount(available);
    setConnection(
      result.status === "connected"
        ? { state: "connected", address: result.address }
        : { state: "unavailable", notice: result.notice },
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {strings.heading}
      </h2>
      <p className="text-sm leading-relaxed text-muted">{strings.intro}</p>

      {connection.state === "connected" ? (
        <>
          <p className="text-xs uppercase tracking-widest text-muted">{strings.connectedAs}</p>
          {/* Shown in full, like every other address here: a truncated one is what a lookalike hides behind. */}
          <p className="break-all font-mono text-sm">{connection.address}</p>
          {/*
           * The address travels in a URL rather than in state, like everything
           * else this application knows: the page it opens can be linked,
           * reloaded and gone back to, and nothing is kept between visits.
           */}
          <a
            href={`/holdings?address=${connection.address}`}
            className="w-fit rounded-md border border-accent px-4 py-2 text-sm text-accent"
          >
            {strings.showHoldings}
          </a>
          <button
            type="button"
            onClick={() => setConnection({ state: "idle" })}
            className="w-fit rounded-md border border-border px-4 py-2 text-sm"
          >
            {strings.forget}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connection.state === "connecting"}
          className="w-fit rounded-md border border-accent px-4 py-2 text-sm text-accent disabled:opacity-60"
        >
          {connection.state === "connecting" ? strings.connecting : strings.connect}
        </button>
      )}

      {connection.state === "unavailable" ? (
        <p className="text-sm leading-relaxed">{strings.notices[connection.notice]}</p>
      ) : null}

      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
        {strings.readOnly}
      </p>
    </section>
  );
}
