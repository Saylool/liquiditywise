import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it } from "vitest";

/*
 * The deploy scripts have to parse. CI runs `bash -n` over every one of them,
 * and a stray apostrophe in a single-quoted description once broke the
 * bot-profile script there and nowhere earlier: this is the same check, run
 * with the rest of the tests, so it fails before a push and not after.
 */

const directory = join(__dirname, "..", "deploy");
const scripts = readdirSync(directory).filter((name) => name.endsWith(".sh"));
const read = (name: string): string => readFileSync(join(directory, name), "utf8");

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

/*
 * The Caddy site block. It hands the application CF-Connecting-IP as the
 * address the rate limit counts, which is only safe while nothing but
 * Cloudflare can connect — so the block must refuse everything else, and it
 * must do so in the block that proxies, not in a guide beside it. nginx gets
 * the same from cloudflare-only.sh; Caddy has only this file.
 */
describe("the Caddy site block", () => {
  const caddyfile = readFileSync(join(directory, "Caddyfile"), "utf8");
  const code = caddyfile
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

  /** Each top-level block, by the name it opens with. */
  const blocks = (() => {
    const found = new Map<string, string>();
    const opening = /^(\S[^{\n]*?)\s*\{\s*$/gm;
    for (const match of code.matchAll(opening)) {
      let depth = 0;
      let end = match.index;
      for (; end < code.length; end += 1) {
        if (code[end] === "{") depth += 1;
        if (code[end] === "}" && --depth === 0) break;
      }
      found.set(match[1] ?? "", code.slice(match.index, end + 1));
    }
    return found;
  })();

  const snippet = blocks.get("(cloudflare_only)") ?? "";
  const ranges = /@outside_cloudflare\s+not\s+remote_ip\s+([^\n]+)/.exec(snippet)?.[1]?.trim().split(/\s+/) ?? [];

  const isRange = (cidr: string): boolean => {
    const [address = "", prefix = "", ...rest] = cidr.split("/");
    const family = isIP(address);
    const bits = Number(prefix);
    return rest.length === 0 && family !== 0 && /^\d+$/.test(prefix) && bits >= 8 && bits <= (family === 4 ? 32 : 128);
  };

  it("drops every connection that is not from one of Cloudflare's ranges", () => {
    expect(snippet).toMatch(/^\s*abort @outside_cloudflare\s*$/m);
    /* Cloudflare publishes about fifteen IPv4 and seven IPv6 ranges; much fewer is a truncated list. */
    expect(ranges.filter((cidr) => isIP(cidr.split("/")[0] ?? "") === 4).length).toBeGreaterThanOrEqual(10);
    expect(ranges.filter((cidr) => isIP(cidr.split("/")[0] ?? "") === 6).length).toBeGreaterThanOrEqual(5);
    for (const cidr of ranges) expect(isRange(cidr), cidr).toBe(true);
  });

  it("refuses outsiders in every block that believes CF-Connecting-IP, and only there is it believed", () => {
    const believing = [...blocks].filter(([, block]) => block.includes("CF-Connecting-IP"));

    expect(believing.map(([name]) => name)).toEqual(["liquiditywise.com"]);
    for (const [name, block] of believing) {
      expect(block, name).toMatch(/^\s*import cloudflare_only\s*$/m);
      expect(block, name).toMatch(/header_up X-Real-IP \{header\.CF-Connecting-IP\}/);
      /* A single address, never a list a client could have started. */
      expect(block, name).toMatch(/header_up X-Forwarded-For \{header\.CF-Connecting-IP\}/);
    }
  });

  it("proxies to the application from no block that does not refuse outsiders", () => {
    for (const [name, block] of blocks) {
      if (block.includes("reverse_proxy")) expect(block, name).toMatch(/^\s*import cloudflare_only\s*$/m);
    }
  });
});

/*
 * Root runs nothing the application user can write.
 *
 * The checkout in /opt/liquiditywise belongs to the user the site runs as, so
 * a root cron job that ran a file from it — or a file that imported one —
 * would turn that account into scheduled root. setup.sh writes the cron file
 * from a block of `echo` lines; these read that block the way cron will.
 */

const setup = read("setup.sh");

/** `NAME="value"` assignments in setup.sh, for the variables the cron lines use. */
const assigned = (name: string): string => {
  const match = new RegExp(`^${name}="([^"$]*)"$`, "m").exec(setup);
  if (!match?.[1]) throw new Error(`setup.sh does not set ${name}`);
  return match[1];
};

const APP_DIR = assigned("APP_DIR");
const APP_USER = assigned("APP_USER");
const LIB_DIR = assigned("LIB_DIR");

type CronLine = { readonly user: string; readonly command: string; readonly line: string };

const cronLines = (): CronLine[] => {
  const block = /^\{\n([\s\S]*?)^\} > \/etc\/cron\.d\/liquiditywise$/m.exec(setup)?.[1];
  if (block === undefined) throw new Error("setup.sh no longer writes /etc/cron.d/liquiditywise from one block");
  return block
    .split("\n")
    .filter((line) => line.trim().startsWith("echo "))
    .map((line) => {
      const text = /^\s*echo "(.*)"$/.exec(line)?.[1];
      if (text === undefined) throw new Error(`not a cron line: ${line}`);
      const expanded = text
        .replaceAll("$APP_USER", APP_USER)
        .replaceAll("$APP_DIR", APP_DIR)
        .replaceAll("$LIB_DIR", LIB_DIR);
      const fields = expanded.split(/\s+/);
      return { user: fields[5] ?? "", command: fields.slice(6).join(" "), line: expanded };
    });
};

/** The command a cron line runs, without its leading VAR=value assignments and trailing redirection. */
const commandWords = (command: string): string[] =>
  command
    .replace(/\s*>\s*\/dev\/null\s*$/, "")
    .split(/\s+/)
    .filter((word) => !/^[A-Z_]+=/.test(word));

const job = (needle: string): CronLine => {
  const found = cronLines().filter((line) => line.command.includes(needle));
  expect(found, needle).toHaveLength(1);
  return found[0] as CronLine;
};

describe("the cron jobs", () => {
  it("are five, each run by the application user or by root", () => {
    const lines = cronLines();

    expect(lines).toHaveLength(5);
    for (const { user, line } of lines) expect(["root", APP_USER], line).toContain(user);
    expect(APP_USER).toBe("liquiditywise");
  });

  it.each(["liquiditywise-telegram-check", "liquiditywise-health", "liquiditywise-backup"])(
    "%s runs as the application user: it needs nothing only root has",
    (name) => {
      expect(job(`/usr/local/bin/${name}`).user).toBe(APP_USER);
    },
  );

  it("the usage report and the Cloudflare allow list are the root jobs, and the only ones", () => {
    expect(job("/usr/local/bin/liquiditywise-usage").user).toBe("root");
    expect(job("cloudflare-only.sh").user).toBe("root");
    expect(cronLines().filter(({ user }) => user === "root")).toHaveLength(2);
  });

  it("no root job runs, or looks on its PATH in, anything under the checkout", () => {
    for (const { user, command, line } of cronLines()) {
      if (user !== "root") continue;
      expect(command, line).not.toContain(APP_DIR);
      expect(command, line).not.toContain("$APP_DIR");
      for (const word of commandWords(command)) {
        expect(
          word === "/bin/bash" || word.startsWith("/usr/local/bin/liquiditywise-") || word.startsWith(`${LIB_DIR}/`) || word.startsWith("--"),
          `${word} in: ${line}`,
        ).toBe(true);
      }
    }
  });

  it("no job's PATH reaches into the checkout", () => {
    for (const { command, line } of cronLines()) {
      const path = /(?:^|\s)PATH=(\S+)/.exec(command)?.[1] ?? "";
      expect(path, line).not.toContain(APP_DIR);
      expect(path, line).not.toContain("$APP_DIR");
    }
    // JOB_PATH is node's directory, worked out on the server: the guard against it being in the checkout is there.
    expect(setup).toMatch(/case "\$JOB_PATH" in\n\s*\*"\$APP_DIR"\*\) .*exit 1 ;;/);
  });

  it("the Cloudflare job runs the root-owned copy in LIB_DIR, with nginx on its PATH", () => {
    const { command } = job("cloudflare-only.sh");

    expect(LIB_DIR).toBe("/usr/local/lib/liquiditywise");
    expect(commandWords(command)).toEqual(["/bin/bash", `${LIB_DIR}/cloudflare-only.sh`]);
    expect(command).toMatch(/PATH=\S*\/usr\/sbin/);
  });

  it("every file a root job runs is installed owned by root and not writable by anyone else", () => {
    const installs = [
      ["/usr/local/bin/liquiditywise-usage", "usage-report.sh", "755"],
      ['"$LIB_DIR/cloudflare-only.sh"', "cloudflare-only.sh", "755"],
      ['"$LIB_DIR/cloudflare_only.py"', "cloudflare_only.py", "644"],
    ] as const;
    for (const [target, source, mode] of installs) {
      expect(setup).toContain(`install -o root -g root -m ${mode} "$APP_DIR/deploy/${source}" ${target}`);
    }
    expect(setup).toContain('install -d -o root -g root -m 755 "$LIB_DIR"');
  });

  it("the copy of cloudflare-only.sh loads nothing from the checkout, and Python is isolated", () => {
    const code = read("cloudflare-only.sh")
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");

    expect(code).not.toContain("APP_DIR");
    expect(code).not.toContain("/opt/liquiditywise");
    expect(code).not.toMatch(/PYTHONPATH|source |^\s*\. /m);
    const pythons = code.match(/python3[^\n|>]*/g) ?? [];
    expect(pythons.length).toBeGreaterThan(0);
    for (const call of pythons) expect(call).toMatch(/^python3 -I "\$HERE\/cloudflare_only\.py"/);
  });

  it("the cloudflare allow list's directory stays root's; the jobs' state has a directory of its own", () => {
    expect(setup).toContain("install -d -o root -g root -m 755 /var/lib/liquiditywise\n");
    expect(setup).toContain('install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$STATE_DIR"');
    expect(assigned("STATE_DIR")).toBe("/var/lib/liquiditywise/state");
    expect(read("health-check.sh")).toContain("/var/lib/liquiditywise/state/health.state");
    expect(read("health-check.sh")).toContain("/var/lib/liquiditywise/state/backup.last");
    expect(read("backup.sh")).toContain("/var/lib/liquiditywise/state/backup.last");
  });
});

/*
 * The same rule, run. Each script is started "as root" — a stub `id` says
 * uid 0 — with stubs for everything it would reach, and the log says who ran
 * what: nothing from the checkout may run while the uid is still 0.
 */

const scratch: string[] = [];
afterEach(() => {
  for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true });
});

const stub = (bin: string, name: string, body: string): void => {
  const path = join(bin, name);
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
};

const asRoot = (script: string, args: readonly string[], options: { follow: boolean }) => {
  const root = mkdtempSync(join(tmpdir(), "lw-deploy-"));
  scratch.push(root);
  const bin = join(root, "bin");
  const app = join(root, "app");
  const log = join(root, "log");
  spawnSync("mkdir", ["-p", bin, app]);
  writeFileSync(join(app, ".env.local"), "REDIS_URL=redis://127.0.0.1:6379/1\nCRON_SECRET=x\n");
  writeFileSync(log, "");

  stub(bin, "id", 'if [ "$#" = 1 ] && [ "$1" = -u ]; then echo "${FAKE_UID:-501}"; else echo 999; fi');
  // Following, setpriv becomes the unprivileged run it starts; otherwise it only says what it was asked.
  stub(
    bin,
    "setpriv",
    `echo "setpriv uid=\${FAKE_UID:-501} $*" >> "$LOG"
${options.follow ? "" : "exit 0"}
while [ "$#" -gt 0 ] && [ "$1" != -- ]; do shift; done; shift
FAKE_UID=999 exec "$@"`,
  );
  for (const name of ["node", "curl", "redis-cli", "journalctl", "openssl", "gzip"]) {
    stub(bin, name, `echo "${name} uid=\${FAKE_UID:-501}" >> "$LOG"; cat > /dev/null 2>&1 < /dev/null; echo 0`);
  }
  stub(bin, "date", "echo 2026-10-01");

  const result = spawnSync("bash", [join(directory, script), ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, FAKE_UID: "0", LOG: log, APP_DIR: app },
  });
  return { result, log: readFileSync(log, "utf8").trim().split("\n").filter(Boolean) };
};

describe("started as root", () => {
  it.each([
    ["telegram-check.sh", []],
    ["health-check.sh", []],
    ["backup.sh", ["--if-set-up"]],
  ] as const)("%s starts itself again as the application user before anything else", (script, args) => {
    const { log } = asRoot(script, args, { follow: false });

    expect(log).toEqual([`setpriv uid=0 --reuid=999 --regid=999 --init-groups -- /bin/bash ${join(directory, script)} ${args.join(" ")}`.trim()]);
  });

  it("usage-report.sh reads the journal as root and runs the report's node code only as the application user", () => {
    const { result, log } = asRoot("usage-report.sh", ["--print"], { follow: true });

    expect(result.status, result.stderr).toBe(0);
    expect(log).toContain("journalctl uid=0");
    expect(log).toContain("node uid=999");
    expect(log.filter((line) => line.endsWith("uid=0"))).toEqual(["journalctl uid=0"]);
    expect(log.find((line) => line.startsWith("setpriv"))).toContain("--journal-on-stdin --print");
  });
});

/*
 * A backup is opened through a strict limit on what it expands to, never
 * into a shell variable: the Worker caps the encrypted size, which bounds
 * nothing once gunzip has it.
 */
describe("restore-backup.sh", () => {
  const restore = read("restore-backup.sh");

  it("captures nothing it decrypts with $(…)", () => {
    for (const capture of restore.match(/\$\([^)]*/g) ?? []) {
      expect(capture).not.toMatch(/openssl|gunzip|zcat|cat "\$plain"/);
    }
    expect(restore).not.toMatch(/=\s*"?\$\(\s*openssl/);
  });

  it("streams through a byte limit into a file only its owner can read, and checks the size before parsing", () => {
    expect(restore).toMatch(/\|\s*\n?\s*head -c "\$\(\(LIMIT \+ 1\)\)" > "\$plain"/);
    expect(restore).toContain('chmod 600 "$plain"');
    expect(restore).toContain("trap 'rm -f \"$plain\"' EXIT");
    expect(restore.indexOf('-gt "$LIMIT"')).toBeGreaterThan(-1);
    expect(restore.indexOf('-gt "$LIMIT"')).toBeLessThan(restore.indexOf("store-backup.mts\" describe"));
    expect(restore).toContain('LIMIT="${RESTORE_LIMIT_BYTES:-$((128 * 1024 * 1024))}"');
  });

  const open = (plain: Buffer, limit: number) => {
    const root = mkdtempSync(join(tmpdir(), "lw-restore-"));
    scratch.push(root);
    const bin = join(root, "bin");
    spawnSync("mkdir", ["-p", bin]);
    // "Decrypts" by handing over the file after -in, which here is plain gzip.
    stub(bin, "openssl", 'while [ "$#" -gt 0 ] && [ "$1" != -in ]; do shift; done; cat "$2"');
    const encrypted = join(root, "backup.p7m");
    writeFileSync(encrypted, gzipSync(plain));
    return spawnSync("bash", [join(directory, "restore-backup.sh"), encrypted, join(root, "key.pem")], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, RESTORE_LIMIT_BYTES: String(limit), TMPDIR: root },
    });
  };

  it("refuses a backup that opens past the limit, and prints none of it", () => {
    const result = open(Buffer.alloc(2 * 1024 * 1024), 1024 * 1024);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("more than 1048576 bytes");
  });

  it("opens one within it, and leaves no plain text behind", () => {
    const snapshot = `${JSON.stringify({ version: 1, takenAt: "2026-10-01T03:17:00.000Z", entries: [] })}\n`;
    const result = open(Buffer.from(snapshot), 1024 * 1024);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(snapshot);
    const root = scratch[scratch.length - 1] as string;
    expect(readdirSync(root).filter((name) => name.startsWith("liquiditywise-restore"))).toEqual([]);
  });
});
