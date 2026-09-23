import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * What deploy/set-bot-profile.sh gives Telegram, held to Telegram's limits.
 * A description one character over is refused outright, and the script only
 * prints `"ok":false` — the bot keeps saying whatever it said before, which
 * after 2026-09-23 was a deletion promise the backups had made untrue.
 */
const script = readFileSync(new URL("../../../deploy/set-bot-profile.sh", import.meta.url), "utf8");

const quoted = (name: string): string => {
  const match = new RegExp(`^${name}='([\\s\\S]*?)'$`, "m").exec(script);
  if (match?.[1] === undefined) throw new Error(`${name} is not in the script`);
  return match[1];
};

describe("the bot's profile fits what Telegram accepts", () => {
  it.each(["DESC_EN", "DESC_TR"])("%s is at most 512 characters", (name) => {
    expect([...quoted(name)].length).toBeLessThanOrEqual(512);
  });

  it.each(["SHORT_EN", "SHORT_TR"])("%s is at most 120 characters", (name) => {
    expect([...quoted(name)].length).toBeLessThanOrEqual(120);
  });

  it.each(["DESC_EN", "DESC_TR"])("%s still says what /stop deletes, and when the backups do", (name) => {
    const text = quoted(name);
    expect(text).toContain("/stop");
    expect(text).toMatch(/seven days|yedi gün/);
  });
});
