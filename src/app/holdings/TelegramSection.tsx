import { cookies } from "next/headers";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import { connectTelegram, disconnectTelegram } from "@/lib/telegram/connectTelegramAction";
import { telegramSetup } from "@/lib/telegram/environment";
import { readLink, TELEGRAM_LINK_COOKIE } from "@/lib/telegram/links";
import type { EvmAddress } from "@/schemas";
import { chainLabel } from "@/lib/chains/chainLabel";
import { type Chain, ETHEREUM } from "@/lib/chains/chains";
import type { Locale } from "@/lib/i18n/locales";

/*
 * Alerts, offered under the positions they are about.
 *
 * Four states, decided by the cookie and the store: not set up on this
 * server; nothing linked; a link minted and not yet presented to the bot;
 * a link the bot has claimed. The button that mints a new link is shown in
 * every state but the first, because a reader may want to switch the address
 * they follow — and each mint replaces the cookie, so one browser follows
 * one address.
 */
export async function TelegramSection({
  address,
  chain,
  t,
  locale,
}: {
  address: EvmAddress;
  /** The chain the page reads, which a new link follows the address on. */
  chain: Chain;
  t: Dictionary;
  locale: Locale;
}) {
  const setup = telegramSetup();
  const token = (await cookies()).get(TELEGRAM_LINK_COOKIE)?.value;
  const link = setup === null || token === undefined ? null : await readLink(setup.store, token);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.telegram.heading}
      </h2>

      {setup === null ? (
        <p className="text-sm leading-relaxed text-muted">{t.telegram.notConfigured}</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{t.telegram.intro}</p>

          {link === undefined ? (
            <p className="text-sm leading-relaxed text-muted">{t.telegram.storeDown}</p>
          ) : link === null ? null : link.chatId === null ? (
            <p className="text-sm leading-relaxed text-muted">{t.telegram.pending}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              {`${t.telegram.connected(link.address)} · ${chainLabel(link.chainId ?? 1, locale)}`}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <form action={connectTelegram}>
              <input type="hidden" name="address" value={address} />
              {chain.id === ETHEREUM.id ? null : <input type="hidden" name="chain" value={chain.slug} />}
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on transition-[filter] hover:brightness-110"
              >
                {t.telegram.connect}
              </button>
            </form>
            {link === null || link === undefined ? null : (
              <form action={disconnectTelegram}>
                <button
                  type="submit"
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted hover:bg-surface-sunken"
                >
                  {t.telegram.forget}
                </button>
              </form>
            )}
          </div>

          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
            {t.telegram.publicNote}
          </p>
        </>
      )}
    </section>
  );
}
