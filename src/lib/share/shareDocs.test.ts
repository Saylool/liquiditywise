import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../../proxy";
import { getDevelopersCopy } from "../i18n/developersCopy";
import { LOCALES } from "../i18n/locales";
import { POOL_ANALYSIS_REQUEST_LIMIT } from "../ratelimit/poolAnalysisRateLimiter";
import { developerFigures } from "../../components/DevelopersPage";
import { EXAMPLE_SHARE_REQUEST, EXAMPLE_SHARE_URL, SHARE_STATUSES } from "./shareDocs";
import { SHARE_CARD_PATH } from "./shareLinks";
import { readShareRequest } from "./shareRequest";
import { shareFailureResponse } from "./shareResponses";

/*
 * The developers page's paragraph on the share card, held to the code it
 * documents: the example address to the parser the route reads with, each
 * status and its lifetime to what the route and the proxy actually answer.
 */

const BROWSER = "Mozilla/5.0 (Macintosh) Safari/605.1.15";

describe("the share card the developers page documents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the example position at the address the route reads", () => {
    const url = new URL(EXAMPLE_SHARE_URL);

    expect(url.pathname).toBe(SHARE_CARD_PATH);
    expect(readShareRequest(url.searchParams)).toEqual(EXAMPLE_SHARE_REQUEST);
  });

  it("states every failure as the route answers it, with the lifetime it says", async () => {
    for (const status of SHARE_STATUSES.filter(({ kind }) => kind !== "card" && kind !== "rate-limited")) {
      const response = shareFailureResponse(status.error as "not-a-position");

      expect(response.status, status.kind).toBe(status.status);
      expect(response.headers.get("cache-control"), status.kind).toBe(status.cacheControl);
      expect(await response.json(), status.kind).toEqual({ error: status.error });
    }
  });

  it("includes the refusal exactly as the proxy sends it, past the limit the page states", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const documented = SHARE_STATUSES.find(({ kind }) => kind === "rate-limited")!;
    const asking = () =>
      new NextRequest(`http://localhost${SHARE_CARD_PATH}?id=998651`, { headers: { "x-forwarded-for": "198.51.100.190", "user-agent": BROWSER } });
    for (let index = 0; index < POOL_ANALYSIS_REQUEST_LIMIT; index += 1) await proxy(asking());
    const refused = await proxy(asking());

    expect(refused.status).toBe(documented.status);
    expect(refused.headers.get("cache-control")).toBe(documented.cacheControl);
    expect(await refused.json()).toMatchObject({ error: documented.error });
  });

  /* The prose names every status and error the route sends, in every language, as code — the same words whoever reads. */
  it("names every status and error in every language's paragraph", () => {
    for (const locale of LOCALES) {
      const text = getDevelopersCopy(locale).share(developerFigures(locale)).join("\n");
      for (const status of SHARE_STATUSES) {
        expect(text, `${locale} ${status.status}`).toContain(`\`${status.status}\``);
        if (status.error !== null && status.kind !== "rate-limited") expect(text, `${locale} ${status.error}`).toContain(`\`${status.error}\``);
      }
      expect(text, locale).toContain("`/api/share/position`");
    }
  });
});
