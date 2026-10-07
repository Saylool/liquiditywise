import Link from "next/link";

import { EMAIL_FORM_ANCHOR } from "../lib/email/formStatus";
import { getEmailDigestCopy } from "../lib/i18n/emailDigestCopy";
import { getHomeAlertsCopy } from "../lib/i18n/homeAlertsCopy";
import { localePath } from "../lib/i18n/localePath";
import type { Locale } from "../lib/i18n/locales";
import { getPairPoolsCopy } from "../lib/i18n/pairPoolsCopy";
import { getSmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import { getWeeklyCopy } from "../lib/i18n/weeklyCopy";
import { ArrowIcon } from "./BrandMark";

/*
 * The front page's way to the things that are not a single pool: where the
 * best-earning liquidity sits — and, beside it, the week's digest of where it
 * moved, which is the bot's Monday message as a page — one pair's pools on
 * every network, and the Telegram bot.
 *
 * The bot's card is only there when alerts are set up on this deployment
 * (`bot` is `null` otherwise): a link to a bot that cannot store a link or
 * answer would be worse than none. Its button goes to the holdings page,
 * where an address is chosen and linked — the bot itself has nothing to do
 * until then — and the bot's own handle is beside it for whoever would rather
 * start there.
 *
 * Beside it, for whoever does not use Telegram, the same digest by e-mail —
 * a short card leading to the form on the weekly page, and likewise only
 * where this deployment can send it. Three cards sit three across; two or
 * four sit two by two.
 */
export function HomeAlerts({
  locale,
  bot,
  emailDigest,
}: {
  locale: Locale;
  bot: { readonly username: string; readonly url: string } | null;
  /** Whether the digest by e-mail is set up here. */
  emailDigest: boolean;
}) {
  const copy = getHomeAlertsCopy(locale);
  const smart = getSmartLiquidityCopy(locale);
  const weekly = getWeeklyCopy(locale);
  const pair = getPairPoolsCopy(locale);
  const email = getEmailDigestCopy(locale);
  const cards = 2 + (bot === null ? 0 : 1) + (emailDigest ? 1 : 0);

  return (
    <section className="landing-section alerts-section" data-reveal>
      <div>
        <p className="eyebrow section-kicker">{copy.kicker}</p>
        <h2 className="section-heading">{copy.heading}</h2>
      </div>
      <div className={`grid gap-4 sm:grid-cols-2 ${cards === 3 ? "lg:grid-cols-3" : ""}`}>
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <h3 className="text-base font-semibold">{smart.link}</h3>
          <p className="text-sm leading-relaxed text-muted">{smart.description}</p>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Link href={localePath(locale, "/smart-money")} prefetch={false} className="text-link text-sm">
              {smart.heading}
              <ArrowIcon />
            </Link>
            <Link href={localePath(locale, "/weekly")} prefetch={false} className="text-link text-sm">
              {weekly.link}
            </Link>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <h3 className="text-base font-semibold">{pair.heading}</h3>
          <p className="text-sm leading-relaxed text-muted">{pair.description}</p>
          <Link href="/pair" prefetch={false} className="text-link text-sm">
            {copy.pairCta}
            <ArrowIcon />
          </Link>
        </div>
        {bot === null ? null : (
          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <h3 className="text-base font-semibold">{copy.telegramTitle}</h3>
            <p className="text-sm leading-relaxed text-muted">{copy.telegramBody}</p>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <Link href="/holdings" prefetch={false} className="text-link text-sm">
                {copy.telegramCta}
                <ArrowIcon />
              </Link>
              <a href={bot.url} rel="noopener noreferrer" className="text-link text-sm">
                {copy.telegramBot(bot.username)}
              </a>
            </div>
          </div>
        )}
        {!emailDigest ? null : (
          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <h3 className="text-base font-semibold">{email.heading}</h3>
            <p className="text-sm leading-relaxed text-muted">{email.body}</p>
            <Link href={`${localePath(locale, "/weekly")}#${EMAIL_FORM_ANCHOR}`} prefetch={false} className="text-link text-sm">
              {email.homeCta}
              <ArrowIcon />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
