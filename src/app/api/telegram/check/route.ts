import { NextResponse, type NextRequest } from "next/server";

import { getAddressPositions } from "@/lib/advisor/getAddressPositions";
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
 * how many read, how many alerts went out. No address leaves this route.
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
  });

  return NextResponse.json({ ok: !summary.storeUnavailable, ...summary });
};

export const GET = run;
export const POST = run;
