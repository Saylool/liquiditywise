/*
 * What `server-only` is, to a test runner.
 *
 * That package has no code in it. It exists so that a bundler fails when a
 * Client Component imports a module meant for the server — the failure is the
 * whole feature. A test runner has no client boundary to cross and no bundler
 * to fail, so there is nothing for it to resolve, and the integration config
 * points the import here.
 *
 * Deliberately not aliased in the default config. Everywhere else the right
 * answer is to test the pure module rather than the server-only wrapper
 * around it, and an alias would quietly make the wrappers importable and the
 * distinction easy to lose.
 */
export {};
