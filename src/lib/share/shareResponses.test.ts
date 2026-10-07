import { describe, expect, it } from "vitest";

import { EMBED_TTL_SECONDS } from "../embed/embedResponses";
import {
  NO_SUCH_POSITION_CACHE,
  NOT_A_POSITION_CACHE,
  SHARE_CARD_CACHE,
  SHARE_TTL_SECONDS,
  SHARE_UNREADABLE_CACHE,
  type ShareFailure,
  shareFailureResponse,
} from "./shareResponses";

describe("how the share card answers when there is no card", () => {
  it("is kept as long as the embed card, since both carry today's price", () => {
    expect(SHARE_TTL_SECONDS).toBe(EMBED_TTL_SECONDS);
    expect(SHARE_CARD_CACHE).toBe("public, max-age=300, s-maxage=300");
  });

  it.each<[ShareFailure, number, string]>([
    ["not-a-position", 400, NOT_A_POSITION_CACHE],
    ["no-such-position", 404, NO_SUCH_POSITION_CACHE],
    ["unreadable", 503, SHARE_UNREADABLE_CACHE],
  ])("answers %s in JSON with status %i, kept as its kind allows", async (failure, status, cache) => {
    const response = shareFailureResponse(failure);

    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe(cache);
    expect(await response.json()).toEqual({ error: failure });
  });

  /* An address that names nothing never changes; an id with no open position under it may be minted or was just closed. */
  it("keeps a malformed address an hour, a missing position only as long as a card, and an unreadable one a minute", () => {
    expect(NOT_A_POSITION_CACHE).toBe("public, max-age=3600, s-maxage=3600");
    expect(NO_SUCH_POSITION_CACHE).toBe("public, max-age=300, s-maxage=300");
    expect(SHARE_UNREADABLE_CACHE).toBe("public, max-age=60, s-maxage=60");
  });
});
