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

/** What a budget answers, in place of running the task, when its line is full. */
export const OVER_BUDGET: unique symbol = Symbol("over budget");

export type Budgeted = <T>(task: () => Promise<T>) => Promise<T | typeof OVER_BUDGET>;

/*
 * At most so many at once, at most so many more in line, and the rest turned
 * away at once.
 *
 * `limitConcurrency` keeps everyone who arrives: right for a page's own
 * forty questions, which are a known number, and wrong for work a stranger
 * can ask for as often as they like. There the line is the cost — every
 * caller waiting holds a request open, and a line nobody bounds is memory
 * nobody bounds — so past `maxWaiting` the task is never started and the
 * caller is told so, to answer however suits it (a card says "try again
 * shortly"; see og/poolCardBudget.ts).
 *
 * A place is counted from the moment a task is admitted to the moment it
 * settles, whichever way: a task that throws gives its place back like one
 * that answered.
 */
export const concurrencyBudget = (atOnce: number, maxWaiting: number): Budgeted => {
  const limited = limitConcurrency(atOnce);
  let admitted = 0;

  return async <T>(task: () => Promise<T>): Promise<T | typeof OVER_BUDGET> => {
    if (admitted >= atOnce + maxWaiting) return OVER_BUDGET;
    admitted += 1;
    try {
      return await limited(task);
    } finally {
      admitted -= 1;
    }
  };
};
