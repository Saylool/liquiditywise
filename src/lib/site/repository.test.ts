import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LICENSE_NAME, LICENSE_URL, REPOSITORY_URL } from "./repository";

/*
 * A link to "the code" is only worth giving if it is the code that runs: the
 * repository the server is set up from, and the licence that repository
 * carries.
 */

const ROOT = process.cwd();

describe("where the code can be read", () => {
  it("is the repository the server is set up from", () => {
    const setup = readFileSync(join(ROOT, "deploy", "setup.sh"), "utf8");

    expect(setup).toContain(`REPO="${REPOSITORY_URL}.git"`);
  });

  it("names the licence the LICENSE file and the package both give", () => {
    const license = readFileSync(join(ROOT, "LICENSE"), "utf8");
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { license?: string };

    expect(license.split("\n")[0]).toBe(`${LICENSE_NAME} License`);
    expect(pkg.license).toBe(LICENSE_NAME);
    expect(LICENSE_URL).toBe(`${REPOSITORY_URL}/blob/main/LICENSE`);
  });
});
