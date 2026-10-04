/*
 * At most so many at once, the rest in line.
 *
 * For questions sent to somebody else's service in bulk — a verifier asked
 * about every hook on a page — where firing them all together would be
 * rude at best and rate-limited at worst. A task's failure is its own: it
 * rejects for whoever awaited it, and the line moves on.
 *
 * Pure but for the promises; the caller decides where a limit is shared
 * (getHookChecks.ts keeps one per service, process-wide).
 */
export type Limited = <T>(task: () => Promise<T>) => Promise<T>;

export const limitConcurrency = (atOnce: number): Limited => {
  let running = 0;
  const waiting: (() => void)[] = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    /*
     * A task that finishes hands its place straight to the next in line
     * rather than giving it up: given up, the place could be taken by a
     * newcomer in the moment before the one waiting woke, and the limit
     * would be one over.
     */
    if (running >= atOnce) await new Promise<void>((resolve) => waiting.push(resolve));
    else running += 1;

    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next === undefined) running -= 1;
      else next();
    }
  };
};
