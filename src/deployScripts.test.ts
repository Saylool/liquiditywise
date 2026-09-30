import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * The deploy scripts have to parse. CI runs `bash -n` over every one of them,
 * and a stray apostrophe in a single-quoted description once broke the
 * bot-profile script there and nowhere earlier: this is the same check, run
 * with the rest of the tests, so it fails before a push and not after.
 */

const directory = join(__dirname, "..", "deploy");
const scripts = readdirSync(directory).filter((name) => name.endsWith(".sh"));

describe("the deploy scripts", () => {
  it("are there to be checked", () => {
    expect(scripts.length).toBeGreaterThan(5);
  });

  it.each(scripts)("%s parses under bash", (name) => {
    const result = spawnSync("bash", ["-n", join(directory, name)], { encoding: "utf8" });

    expect(result.stderr, name).toBe("");
    expect(result.status, name).toBe(0);
  });
});
