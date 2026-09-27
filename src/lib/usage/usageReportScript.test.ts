import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * The weekly report runs on the server under plain Node, which resolves no
 * extensionless import. The unit tests import the same files through Vite,
 * which does — so an `import ... from "../chains/chains"` passed them all and
 * would have failed the first Monday it ran. This runs the script itself.
 */
const SCRIPT = join(__dirname, "..", "..", "..", "deploy", "usage-report.mts");

describe("the weekly report script", () => {
  it("runs under plain Node and prints the week's report", () => {
    const lines = [
      "2026-09-21T10:00:00+0000 srv npm[1]: [visit] page=/most-traded pool=- locale=tr bot=0 outcome=served chain=base",
      "2026-09-21T10:00:01+0000 srv npm[1]: [visit] page=/learn/divergence pool=- locale=tr bot=0 outcome=served",
    ].join("\n");
    const run = spawnSync(process.execPath, [SCRIPT, "--from", "2026-09-21", "--to", "2026-09-27"], {
      input: lines,
      encoding: "utf8",
      env: { ...process.env, TELEGRAM_LINKS: "3", NODE_NO_WARNINGS: "1" },
    });

    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("📊 LiquidityWise · the week of 21 Sep – 27 Sep");
    expect(run.stdout).toContain("Chains: base 1");
    expect(run.stdout).toContain("Telegram: 3 chats following an address");
  });
});
