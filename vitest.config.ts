import { configDefaults, defineConfig } from "vitest/config";

/*
 * The suite runs on Vitest's own defaults; this file exists for one reason.
 *
 * A background task gets its own checkout of this repository under `.claude`,
 * and the default globs find the tests in it. The suite then runs twice — once
 * against the working tree and once against whatever that copy happens to hold,
 * which may be older, newer, or mid-edit. A failure from it looks like a
 * failure here, and a pass from it hides one.
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
