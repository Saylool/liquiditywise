import { describe, expect, it } from "vitest";

import { LOCALES } from "../i18n/locales";
import { BRIEF_IDS, getLearnCopy } from "./briefs";
import { getTopicCopy } from "./topics";

describe("each topic's own page", () => {
  it("adds three sentences to every brief, in every language, none repeating the guide's", () => {
    for (const locale of LOCALES) {
      const copy = getTopicCopy(locale);
      for (const id of BRIEF_IDS) {
        const more = copy.more[id];
        const guide = getLearnCopy(locale).briefs.find((brief) => brief.id === id)!.points;
        expect(more, `${locale} ${id}`).toHaveLength(3);
        expect(new Set([...more, ...guide]).size, `${locale} ${id}`).toBe(6);
        for (const sentence of more) expect(sentence.trim(), `${locale} ${id}`).not.toBe("");
      }
      expect(copy.otherTopics.trim(), locale).not.toBe("");
      expect(copy.backToGuide.trim(), locale).not.toBe("");
    }
  });

  it("is written in each language, not left in English", () => {
    const english = getTopicCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getTopicCopy(locale);
      for (const id of BRIEF_IDS) {
        copy.more[id].forEach((sentence, index) => expect(sentence, `${locale} ${id} ${index}`).not.toBe(english.more[id][index]));
      }
      expect(copy.otherTopics, locale).not.toBe(english.otherTopics);
    }
  });

  /* Nothing here is a figure about any pool: no digit in any language's sentences but the protocol's own v3/v4. */
  it("states no figure", () => {
    for (const locale of LOCALES) {
      const text = Object.values(getTopicCopy(locale).more).flat().join(" ").replace(/v[34]/g, "");
      expect(text, locale).not.toMatch(/[0-9]/);
    }
  });

  it("uses the Turkish interface's words, not their near-synonyms", () => {
    const text = JSON.stringify(getTopicCopy("tr"));

    expect(text).toContain("komisyon");
    expect(text).toContain("takas");
    expect(text).not.toMatch(/ücret/i);
    expect(text).not.toMatch(/\bswap/i);
    expect(text).not.toMatch(/\bgaz\b/i);
  });

  it("keeps the German to the interface's words for a swap and a deposit", () => {
    const text = JSON.stringify(getTopicCopy("de"));

    expect(text).toContain("Tausch");
    expect(text).toContain("Einlage");
  });
});
