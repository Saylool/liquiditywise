/*
 * One value per process, whichever bundle asks for it.
 *
 * Next compiles `instrumentation.ts` apart from the app's routes, so a module's
 * own `const cached = new Map()` is one Map in the pages and another in
 * anything started from there. The cache warmer runs from there: a Map of its
 * own would be filled every twenty-five minutes and read by nobody. Kept on
 * `globalThis` under a registered symbol, both halves find the same one.
 */
export const processShared = <T>(name: string, create: () => T): T => {
  const key = Symbol.for(`liquiditywise.${name}`);
  const store = globalThis as unknown as Record<symbol, unknown>;
  if (!(key in store)) store[key] = create();

  return store[key] as T;
};
