import { describe, expect, it } from "vitest";

import { KEEP_SECONDS } from "../../../deploy/backup-worker/worker";
import { getDictionary } from "../i18n/dictionaries";
import { LOCALES } from "../i18n/locales";

/*
 * What readers are told about their link and what the backup does, held
 * together. The site says a link is deleted from the server at once and from
 * the backups within seven days; that is only true while the Worker that
 * keeps them tells KV to drop each copy after seven days. Change one without
 * the other and the promise is false, in ten languages, with nothing to say so.
 */

describe("the backup keeps what readers are told it keeps", () => {
  it("drops each copy after seven days", () => {
    expect(KEEP_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("says seven days, in English, everywhere the deletion is promised", () => {
    const en = getDictionary("en");

    expect(en.telegram.intro).toContain("encrypted backups within seven days");
    expect(en.telegram.stopped).toContain("within seven days");
  });

  it.each(LOCALES)("promises, in %s, that /stop still deletes something at once", (locale) => {
    const { telegram } = getDictionary(locale);

    expect(telegram.intro).toContain("/stop");
    expect(telegram.stopped.length).toBeGreaterThan(telegram.nothingToStop.length);
  });
});
