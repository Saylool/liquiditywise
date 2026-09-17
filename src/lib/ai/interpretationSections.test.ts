import { describe, expect, it } from "vitest";

import { MAX_SECTION_CHARACTERS } from "../../schemas";
import {
  completedSection,
  newlyFinishedSections,
  SECTION_KEYS,
  verifiedSection,
} from "./interpretationSections";

const PROSE = "The suggested range is a band of prices with the current price inside it, and it was drawn from how far this pair has already moved.";

describe("SECTION_KEYS", () => {
  it("is the four sections, in the order they are written and read", () => {
    expect(SECTION_KEYS).toEqual([
      "whatThisRangeMeans",
      "ifPriceLeavesTheRange",
      "whatTheVolatilitySays",
      "whatThisDoesNotCover",
    ]);
  });
});

describe("completedSection", () => {
  it("reads a field whose closing quote has arrived", () => {
    expect(completedSection(`{"whatThisRangeMeans":"${PROSE}"`, "whatThisRangeMeans")).toBe(PROSE);
  });

  it("waits while the field is still being written", () => {
    expect(completedSection(`{"whatThisRangeMeans":"The range is`, "whatThisRangeMeans")).toBeNull();
  });

  it.each([
    ["nothing yet", "{"],
    ["the key but no colon", '{"whatThisRangeMeans'],
    ["the colon but no value", '{"whatThisRangeMeans":'],
  ])("waits when the answer has only %s", (_label, partial) => {
    expect(completedSection(partial, "whatThisRangeMeans")).toBeNull();
  });

  /* A paragraph may quote something, and the escaped quote is not the end of it. */
  it("is not ended by a quotation mark inside the prose", () => {
    const quoting = 'She called it \\"impermanent\\" loss, which it is not';

    expect(completedSection(`{"whatThisRangeMeans":"${quoting}"`, "whatThisRangeMeans")).toBe(
      'She called it "impermanent" loss, which it is not',
    );
  });

  it("is not ended by a backslash before the closing quote", () => {
    expect(completedSection('{"a":"one \\\\"', "a")).toBe("one \\");
  });

  it("unescapes what the platform escapes", () => {
    expect(completedSection('{"a":"one\\ntwo \\u00e7"', "a")).toBe("one\ntwo ç");
  });

  it("reads a later field without being confused by an earlier one", () => {
    const partial = `{"whatThisRangeMeans":"${PROSE}","ifPriceLeavesTheRange":"${PROSE}`;

    expect(completedSection(partial, "whatThisRangeMeans")).toBe(PROSE);
    expect(completedSection(partial, "ifPriceLeavesTheRange")).toBeNull();
  });

  it("has nothing to say about a key that is not there", () => {
    expect(completedSection(`{"whatThisRangeMeans":"${PROSE}"}`, "somethingElse")).toBeNull();
  });
});

describe("verifiedSection", () => {
  it("passes prose that follows the rule", () => {
    expect(verifiedSection("whatThisRangeMeans", PROSE)).toBe(PROSE);
  });

  /* The one rule this whole project rests on: the model states no figures. */
  it("refuses a section that states a figure", () => {
    expect(verifiedSection("whatThisRangeMeans", `${PROSE} It is 3,000 USDC.`)).toBeNull();
  });

  it("still allows a protocol version, which is not a figure", () => {
    expect(verifiedSection("whatThisRangeMeans", `${PROSE} This is a Uniswap v3 pool.`)).toBe(
      `${PROSE} This is a Uniswap v3 pool.`,
    );
  });

  it("refuses a section too short to explain anything", () => {
    expect(verifiedSection("whatThisRangeMeans", "Too short.")).toBeNull();
  });

  it("refuses a section longer than the ceiling", () => {
    expect(verifiedSection("whatThisRangeMeans", "a".repeat(MAX_SECTION_CHARACTERS + 1))).toBeNull();
  });
});

describe("newlyFinishedSections", () => {
  const two = `{"whatThisRangeMeans":"${PROSE}","ifPriceLeavesTheRange":"${PROSE}"`;

  it("names every section that has finished and passed", () => {
    expect(newlyFinishedSections(two, new Set()).map((section) => section.key)).toEqual([
      "whatThisRangeMeans",
      "ifPriceLeavesTheRange",
    ]);
  });

  it("leaves out the ones already delivered", () => {
    expect(newlyFinishedSections(two, new Set(["whatThisRangeMeans"]))).toEqual([
      { key: "ifPriceLeavesTheRange", prose: PROSE },
    ]);
  });

  /* A section that breaks the rule is not released early; the whole answer is refused later. */
  it("holds back a finished section that breaks the rule", () => {
    const withFigure = `{"whatThisRangeMeans":"${PROSE} It is 3,000 USDC.","ifPriceLeavesTheRange":"${PROSE}"`;

    expect(newlyFinishedSections(withFigure, new Set()).map((section) => section.key)).toEqual([
      "ifPriceLeavesTheRange",
    ]);
  });

  it("has nothing for an answer that has not started", () => {
    expect(newlyFinishedSections("", new Set())).toEqual([]);
  });
});
