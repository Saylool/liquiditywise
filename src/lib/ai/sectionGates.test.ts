import { describe, expect, it } from "vitest";

import { SECTION_KEYS } from "./interpretationSections";
import { createSectionGates, settledSectionGates } from "./sectionGates";

const PROSE = "The range is a band of prices with the current price inside it.";

describe("createSectionGates", () => {
  it("offers one promise per section", () => {
    const gates = createSectionGates();

    expect(Object.keys(gates.sections)).toEqual([...SECTION_KEYS]);
  });

  it("settles a section when its prose is delivered", async () => {
    const gates = createSectionGates();
    gates.deliver("whatThisRangeMeans", PROSE);

    await expect(gates.sections.whatThisRangeMeans).resolves.toEqual({
      status: "written",
      prose: PROSE,
    });
  });

  /* A boundary whose promise never settles is a panel that spins for ever. */
  it("settles every section that never arrived", async () => {
    const gates = createSectionGates();
    gates.deliver("whatThisRangeMeans", PROSE);
    gates.closeRemaining();

    await expect(gates.sections.ifPriceLeavesTheRange).resolves.toEqual({ status: "missing" });
    await expect(gates.sections.whatThisDoesNotCover).resolves.toEqual({ status: "missing" });
  });

  it("leaves a delivered section alone when the rest are closed", async () => {
    const gates = createSectionGates();
    gates.deliver("whatThisRangeMeans", PROSE);
    gates.closeRemaining();

    await expect(gates.sections.whatThisRangeMeans).resolves.toEqual({
      status: "written",
      prose: PROSE,
    });
  });

  /* A promise settles once; a second delivery is the provider repeating itself. */
  it("keeps the first prose a section was given", async () => {
    const gates = createSectionGates();
    gates.deliver("whatThisRangeMeans", PROSE);
    gates.deliver("whatThisRangeMeans", "something else entirely");

    await expect(gates.sections.whatThisRangeMeans).resolves.toEqual({
      status: "written",
      prose: PROSE,
    });
  });

  it("can be closed twice without complaint", async () => {
    const gates = createSectionGates();
    gates.closeRemaining();
    gates.closeRemaining();

    await expect(gates.sections.whatThisRangeMeans).resolves.toEqual({ status: "missing" });
  });
});

describe("settledSectionGates", () => {
  /* A cached answer has every paragraph already, so nothing waits for anything. */
  it("hands back every section at once", async () => {
    const prose = Object.fromEntries(SECTION_KEYS.map((key) => [key, `${key}: ${PROSE}`])) as Record<
      (typeof SECTION_KEYS)[number],
      string
    >;
    const sections = settledSectionGates(prose);

    await expect(Promise.all(SECTION_KEYS.map((key) => sections[key]))).resolves.toEqual(
      SECTION_KEYS.map((key) => ({ status: "written", prose: `${key}: ${PROSE}` })),
    );
  });
});
