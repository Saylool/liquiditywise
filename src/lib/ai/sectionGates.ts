import { SECTION_KEYS, type SectionKey } from "./interpretationSections";

/*
 * One promise per paragraph, so a page can render each the moment it exists.
 *
 * The explanation arrives as one stream and is shown as four sections, which
 * means four things that settle at four different times. A promise each is the
 * whole mechanism: the page renders a boundary per section, React sends each as
 * its promise resolves, and nothing in the browser has to run for that to work.
 *
 * Every gate settles exactly once, and all of them settle: `closeRemaining` is
 * what the caller owes the page when the answer is finished or has failed,
 * because a boundary whose promise never settles is a panel that spins for ever.
 */

/** What became of one section: prose that passed its rule, or nothing. */
export type SectionOutcome =
  | { readonly status: "written"; readonly prose: string }
  | { readonly status: "missing" };

const MISSING: SectionOutcome = { status: "missing" };

export type SectionGates = {
  /** One per section, in the reading order the schema declares. */
  readonly sections: Readonly<Record<SectionKey, Promise<SectionOutcome>>>;
  /** Hands one section its prose. Later calls for the same section are ignored. */
  readonly deliver: (key: SectionKey, prose: string) => void;
  /** Settles every section that never arrived, so no boundary is left open. */
  readonly closeRemaining: () => void;
};

export const createSectionGates = (): SectionGates => {
  const settle = new Map<SectionKey, (outcome: SectionOutcome) => void>();
  const sections = Object.fromEntries(
    SECTION_KEYS.map((key) => [
      key,
      new Promise<SectionOutcome>((resolve) => {
        settle.set(key, resolve);
      }),
    ]),
  ) as Record<SectionKey, Promise<SectionOutcome>>;

  return {
    sections,
    deliver: (key, prose) => {
      const resolve = settle.get(key);
      if (resolve === undefined) return;
      settle.delete(key);
      resolve({ status: "written", prose });
    },
    closeRemaining: () => {
      for (const resolve of settle.values()) resolve(MISSING);
      settle.clear();
    },
  };
};

/** Gates that are already settled, for an answer that was in the cache. */
export const settledSectionGates = (
  prose: Readonly<Record<SectionKey, string>>,
): Readonly<Record<SectionKey, Promise<SectionOutcome>>> =>
  Object.fromEntries(
    SECTION_KEYS.map((key) => [key, Promise.resolve<SectionOutcome>({ status: "written", prose: prose[key] })]),
  ) as Record<SectionKey, Promise<SectionOutcome>>;
