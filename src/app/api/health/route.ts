import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { takeAppReadings } from "@/lib/health/appReadings";
import { problemsFrom } from "@/lib/health/problems";
import { telegramSetup } from "@/lib/telegram/environment";
import { sameSecret } from "@/lib/telegram/secrets";

/*
 * What is wrong with this deployment, in sentences.
 *
 * Called every few minutes by `deploy/health-check.sh` on the same machine.
 * That script can see things this process cannot — whether this process is
 * running at all, how long the certificate has left, how full the disk is —
 * and this process can see things the script cannot, so the script hands its
 * readings over as query parameters and gets the whole verdict back worded.
 *
 * The wording is here rather than in the script so that the thresholds, and
 * what each fault tells someone to go and look at, are a test rather than a
 * line of shell nobody runs until the night it matters.
 */

export const dynamic = "force-dynamic";

/** Both are whole numbers a shell computed; days may be negative once expired. */
const ReadingsSchema = z.object({
  certificateDays: z.coerce.number().int().min(-3650).max(3650).optional(),
  diskPercent: z.coerce.number().int().min(0).max(100).optional(),
});

const bearer = (header: string | null): string | null => {
  const match = /^Bearer\s+(\S+)$/.exec(header ?? "");
  return match?.[1] ?? null;
};

/** Absent stays absent: an unmeasured reading must not arrive as a zero. */
const given = (value: string | null): string | undefined => value ?? undefined;

const run = async (request: NextRequest): Promise<NextResponse> => {
  const setup = telegramSetup();
  if (setup === null) return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 503 });

  if (!sameSecret(bearer(request.headers.get("authorization")), setup.cronSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const outside = ReadingsSchema.safeParse({
    certificateDays: given(searchParams.get("certificateDays")),
    diskPercent: given(searchParams.get("diskPercent")),
  });

  /*
   * A reading that will not parse is dropped rather than refused. The point
   * of this route is to answer while something is wrong, and a `df` that
   * printed something unexpected must not cost the operator the two readings
   * that did arrive.
   */
  const inside = await takeAppReadings({ store: setup.store, now: new Date() });
  const problems = problemsFrom({ ...inside, ...(outside.success ? outside.data : {}) });

  return NextResponse.json({ ok: problems.length === 0, problems });
};

export const GET = run;
export const POST = run;
