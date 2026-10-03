import type { NextRequest } from "next/server";

import { answerEmbed } from "@/lib/embed/answerEmbed";
import { readEmbedLocale } from "@/lib/embed/embedRequest";
import { embedCardResponse } from "@/lib/embed/embedResponses";

/*
 * The pool card other sites put in a frame: one pool's suggested range for
 * the default horizon and width, its current price, and the way back to its
 * page here.
 *
 *   <iframe src="https://liquiditywise.com/embed/pool?chain=base&address=0x…&lang=tr">
 *
 * A route rather than a page, because a page comes inside the site's layout
 * and a card wants nothing around it (see lib/embed/embedCard.ts). The only
 * address on the site any other site may frame — the proxy opens it, and only
 * it (see lib/security/responseHeaders.ts). Charged against the reader's
 * allowance like the pool page it stands for, by the same proxy, and closed to
 * crawlers: it reads one pool live, and is only true for the moment it read it.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const parameters = request.nextUrl.searchParams;
  return embedCardResponse(await answerEmbed(parameters), readEmbedLocale(parameters));
}
