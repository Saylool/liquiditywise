import { NextResponse, type NextRequest } from "next/server";

import { takeAppReadings } from "@/lib/health/appReadings";
import { readOutsideReadings } from "@/lib/health/outsideReadings";
import { problemsFrom } from "@/lib/health/problems";
import { telegramSetup } from "@/lib/telegram/environment";
import { sameSecret } from "@/lib/telegram/secrets";

/*
 * What is wrong with this deployment, in sentences.
 *
 * Called every few minutes by `deploy/health-check.sh` on the same machine.
 * That script can see things this process cannot — whether this process is
 * running at all, how long the certificate has left, how full the disk is,
 * whether Redis writes as it goes — and this process can see things the
 * script cannot, so the script hands its readings over as query parameters
 * and gets the whole verdict back worded.
 *
 * The wording is here rather than in the script so that the thresholds, and
 * what each fault tells someone to go and look at, are a test rather than a
 * line of shell nobody runs until the night it matters.
 */

export const dynamic = "force-dynamic";

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

  const inside = await takeAppReadings({ store: setup.store, now: new Date() });
  const problems = problemsFrom({ ...inside, ...readOutsideReadings(request.nextUrl.searchParams) });

  return NextResponse.json({ ok: problems.length === 0, problems });
};

export const GET = run;
export const POST = run;
