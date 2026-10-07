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

  it.each(["DESC_EN", "DESC_TR"])("%s says what /weekly keeps", (name) => {
    expect(quoted(name)).toContain("/weekly");
  });

  it.each([
    ["DESC_EN", /\/watch.*the pool and the range last told/s],
    ["DESC_TR", /\/watch.*havuzu ve son aralığı/s],
  ])("%s says what a pool watch keeps, and that /watch needs no address", (name, words) => {
    expect(quoted(name)).toMatch(words);
    expect(quoted(name)).toMatch(/no address needed|adres gerekmeden/);
  });

  /* A single-quoted shell string ends at the first apostrophe: "a pool's range" would end the description there. */
  it.each(["DESC_EN", "DESC_TR", "SHORT_EN", "SHORT_TR"])("%s carries no apostrophe", (name) => {
    expect(quoted(name)).not.toContain("'");
  });

  it.each([
    ["DESC_EN", /leave.*paid in range.*re-centre/s],
    ["DESC_TR", /çıkınca havuzun.*aralıkta ödediğini.*yeniden ortalamanın takas komisyonunu/s],
  ])("%s says what an alert that a position has left its range adds", (name, words) => {
    expect(quoted(name)).toMatch(words);
  });

  it("lists /weekly and the pool-watch commands among the commands, in every language the menu is set in", () => {
    const menus = [...script.matchAll(/'commands=(\[[^']*\])'/g)].map((match) => JSON.parse(match[1] ?? "[]") as { command: string; description: string }[]);

    expect(menus).toHaveLength(2);
    for (const menu of menus) {
      expect(menu.map(({ command }) => command)).toEqual(["start", "watch", "unwatch", "watches", "smart", "weekly", "stop"]);
      for (const { description } of menu) {
        expect(description.length).toBeLessThanOrEqual(256);
        expect(description.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
