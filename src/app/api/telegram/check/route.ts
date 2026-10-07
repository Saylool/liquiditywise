import { NextResponse, type NextRequest } from "next/server";

import { getAddressPositions } from "@/lib/advisor/getAddressPositions";
import { pairPoolReaders } from "@/lib/advisor/getPairPools";
import { peekSmartLiquidity } from "@/lib/advisor/getSmartLiquidity";
import { smartPairsByPool } from "@/lib/advisor/smartRanges";
import { readSeries } from "@/lib/advisor/smartStore";
import { chainOf } from "@/lib/chains/chains";
import { emailDigestSetup } from "@/lib/email/environment";
import { sendDigestEmails } from "@/lib/email/sendDigests";
import { recordAlertRun } from "@/lib/health/appReadings";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { checkWatches } from "@/lib/telegram/checkWatches";
import { telegramSetup } from "@/lib/telegram/environment";
import { sameSecret } from "@/lib/telegram/secrets";

/*
 * The scheduled pass over every linked address.
 *
 * Called by whatever schedules things where this runs — Vercel's cron with
 * its `Authorization: Bearer <CRON_SECRET>`, or a crontab's `curl` with the
 * same header at home. The answer is counts and nothing else: how many links,
 * how many read, how many alerts and Monday digests went out — and, where the
 * digest by e-mail is set up, how many of those went out by mail. No address
 * of either kind leaves this route.
 *
 * The e-mail pass rides on this one rather than on a schedule of its own, as
 * the bot's digest does: the same cron, the same hour, the same rule for
 * when a digest is due (email/sendDigests.ts). It runs after the links, so a
 * slow provider holds no alert back, and before the heartbeat, so a pass
 * that died in it leaves no claim that it ran.
 */

export const dynamic = "force-dynamic";

/** A pass reads several addresses in series, and each is a few seconds. */
export const maxDuration = 300;

const bearer = (header: string | null): string | null => {
  const match = /^Bearer\s+(\S+)$/.exec(header ?? "");
  return match?.[1] ?? null;
};

const run = async (request: NextRequest): Promise<NextResponse> => {
  const setup = telegramSetup();
  if (setup === null) return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 503 });

  if (!sameSecret(bearer(request.headers.get("authorization")), setup.cronSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const summary = await checkWatches({
    store: setup.store,
    bot: setup.bot,
    readPositions: getAddressPositions,
    dictionary: getDictionary,
    /* Only what the six-hourly measurement has kept: this pass never starts one. */
    readSmartPairs: (chainId) => smartPairsByPool(peekSmartLiquidity(chainId)),
    /* The Monday digest reads the series the measurement keeps beside the links, in the same store. */
    readSmartSeries: (chainId) => readSeries(setup.store, chainOf(chainId).slug).catch(() => null),
    now: () => new Date(),
    /*
     * The pair page's own readers, behind their own caches, for the fee yield
     * a left-range alert gives: a day table the warmer keeps, or a pair
     * searched on the site in the last ten minutes, costs this pass nothing.
     */
    pairReaders: pairPoolReaders,
  });

  /* The same digest to the addresses that asked for it by e-mail, where this deployment can send it. */
  const email = emailDigestSetup();
  const mailed =
    email === null
      ? null
      : await sendDigestEmails({
          store: email.store,
          sendEmail: email.provider.sendEmail,
          secret: email.secret,
          dictionary: getDictionary,
          readSmartSeries: (chainId) => readSeries(email.store, chainOf(chainId).slug).catch(() => null),
          now: () => new Date(),
        });

  /*
   * The pass finished. The mark it leaves is what lets the health check tell
   * a schedule that has stopped from one that is merely quiet, and it is
   * written after the work rather than before so that a pass which dies
   * halfway leaves no claim that it ran.
   */
  if (!summary.storeUnavailable) await recordAlertRun(setup.store, new Date());

  return NextResponse.json({
    ok: !summary.storeUnavailable,
    ...summary,
    ...(mailed === null ? {} : { email: mailed }),
  });
};

export const GET = run;
export const POST = run;
