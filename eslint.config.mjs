import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * Worktrees. A background task gets its own checkout under `.claude`, build
     * output and all, and linting it means reporting Turbopack's generated
     * chunks as this project's own code — hundreds of errors in files nobody
     * wrote. Gitignored, so nothing here is ever source.
     */
    ".claude/**",
  ]),
]);

export default eslintConfig;
