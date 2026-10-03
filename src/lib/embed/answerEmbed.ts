import "server-only";

import type { EmbedAnswer } from "./embedResponses";
import { readEmbedRequest } from "./embedRequest";
import { embeddedPoolUrl } from "./poolEmbed";
import { readPoolEmbed } from "./readPoolEmbed";

/**
 * What a card's address is answered with, for both the card and its JSON:
 * nothing is read for an address that names no pool this site reads, and a
 * pool that could not be read keeps its link to its own page.
 */
export const answerEmbed = async (parameters: URLSearchParams): Promise<EmbedAnswer> => {
  const asked = readEmbedRequest(parameters);
  if (asked === null) return { kind: "not-a-pool" };

  const read = await readPoolEmbed(asked);
  return read.status === "read"
    ? { kind: "pool", figures: read.figures }
    : { kind: "unreadable", poolUrl: embeddedPoolUrl(asked) };
};
