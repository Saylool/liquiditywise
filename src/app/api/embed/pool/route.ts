import type { NextRequest } from "next/server";

import { answerEmbed } from "@/lib/embed/answerEmbed";
import { readEmbedLocale } from "@/lib/embed/embedRequest";
import { embedDataResponse } from "@/lib/embed/embedResponses";

/*
 * The embeddable card's figures as JSON, for a site that would rather draw
 * them itself: the same address, the same reading, the same cache.
 *
 *   GET /api/embed/pool?chain=unichain&id=0x…
 *
 * Every number a number, in the direction the pool page shows it, with the
 * horizon and width it was drawn for, when the price was read, the link back
 * and a disclaimer — checked against a schema on the way out (see
 * lib/embed/poolEmbed.ts). Readable from any origin, and charged against the
 * caller's allowance by the proxy like every other read of a pool.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const parameters = request.nextUrl.searchParams;
  return embedDataResponse(await answerEmbed(parameters), readEmbedLocale(parameters));
}
