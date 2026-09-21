import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/*
 * The tests that need a port.
 *
 * Separate from the default run because the sandbox this project is developed
 * in cannot `listen()`, and a suite that always fails locally is a suite
 * nobody runs. These are run on a machine that can:
 *
 *   npx vitest run --config vitest.integration.mts
 */
export default defineConfig({
  resolve: {
    alias: {
      /*
       * `server-only` has no code in it: it exists so a bundler fails when a
       * Client Component imports a server module. There is no such boundary
       * here, so it resolves to nothing rather than to a package that was
       * never meant to be loaded.
       */
      "server-only": fileURLToPath(new URL("./src/lib/testing/serverOnly.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.integration.spec.ts"],
    exclude: [".claude/**", "node_modules/**"],
  },
});
