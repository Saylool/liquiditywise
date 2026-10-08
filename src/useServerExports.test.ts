import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * A "use server" file may export async functions and nothing else. Types,
 * lint and tests all pass with a constant beside the actions; only
 * `next build` refuses it, and CI found it there on 2026-10-08 (a rate
 * budget exported from the Telegram action). Checked here, where it is quick.
 */

const SRC = join(process.cwd(), "src");

const files = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

const serverFiles = files(SRC).filter((path) => /^\s*["']use server["'];?/.test(readFileSync(path, "utf8")));

describe('a "use server" file', () => {
  it("is found, so this is not passing on an empty list", () => {
    expect(serverFiles.length).toBeGreaterThan(0);
  });

  it.each(serverFiles.map((path) => [path.slice(SRC.length + 1), path]))("%s exports only async functions", (_name, path) => {
    const source = readFileSync(path, "utf8");
    const exported = source.split("\n").filter((line) => /^export\s/.test(line) && !/^export\s+(type|interface)\s/.test(line));

    for (const line of exported) {
      expect(line, line).toMatch(/^export\s+(async\s+function\s|const\s+\w+\s*=\s*async\s)/);
    }
  });
});
