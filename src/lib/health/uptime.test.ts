import { describe, expect, it } from "vitest";

import {
  decideFleet,
  decideSite,
  DOWN_AFTER_FAILURES,
  type FleetMemory,
  isReachable,
  readFleetMemory,
  readSites,
  type Site,
  type UptimeMemory,
} from "./uptime";

const SITES: readonly Site[] = [
  { name: "liquiditywise.com", url: "https://liquiditywise.com/api/health" },
  { name: "ensdesk.com", url: "https://ensdesk.com/" },
  { name: "splitstable.com", url: "https://splitstable.com/" },
];

/** Every site answering the same way on one run. */
const all = (status: number | null) => Object.fromEntries(SITES.map((site) => [site.name, status]));

/** Runs a sequence of rounds through the fleet decision, as the Worker would. */
const replay = (rounds: readonly Readonly<Record<string, number | null>>[], sites = SITES) => {
  let memory: FleetMemory | null = null;
  const messages: string[] = [];
  let writes = 0;
  for (const statuses of rounds) {
    const decision = decideFleet(sites, memory, statuses);
    if (decision.message !== null) messages.push(decision.message);
    if (decision.changed) writes += 1;
    memory = decision.memory;
  }
  return { memory, messages, writes };
};

describe("what counts as reachable", () => {
  /*
   * Each of these is the site itself answering, and each is today's real
   * healthy answer from one of the three: liquiditywise's unauthenticated
   * health probe gets 401, ensdesk redirects to its login, splitstable 200s.
   */
  it("counts anything a site answers as reachable", () => {
    expect(isReachable(200)).toBe(true);
    expect(isReachable(307)).toBe(true);
    expect(isReachable(401)).toBe(true);
    expect(isReachable(499)).toBe(true);
  });

  it("counts Cloudflare's origin errors, a gateway error and silence as unreachable", () => {
    expect(isReachable(500)).toBe(false);
    expect(isReachable(502)).toBe(false);
    expect(isReachable(522)).toBe(false);
    expect(isReachable(null)).toBe(false);
    expect(isReachable(0)).toBe(false);
  });
});

describe("one site, on its own", () => {
  /*
   * The reason for the threshold. A deploy restarts a service for a few
   * seconds, one check can land in that gap, and a single failure reported as
   * an outage would be followed five minutes later by a recovery.
   */
  it("does not cross the line on one failure", () => {
    expect(decideSite(null, 502).became).toBeNull();
  });

  it("crosses it once the failures reach the threshold", () => {
    let memory: UptimeMemory | null = null;
    let became = null;
    for (let run = 0; run < DOWN_AFTER_FAILURES; run += 1) {
      const decision = decideSite(memory, 522);
      memory = decision.memory;
      became = decision.became;
    }
    expect(became).toBe("down");
    expect(memory).toEqual({ state: "down", failures: DOWN_AFTER_FAILURES });
  });

  it("comes back on the first good answer", () => {
    expect(decideSite({ state: "down", failures: 2 }, 200).became).toBe("up");
  });

  it("writes nothing while it stays up", () => {
    expect(decideSite({ state: "up", failures: 0 }, 200).changed).toBe(false);
  });
});

describe("telling the server from one site", () => {
  it("stays silent while everything answers", () => {
    expect(replay([all(200), all(200), all(200)]).messages).toEqual([]);
  });

  /*
   * The outage nothing on the server can report, and the one this exists
   * for: every site down together. One message naming the shared cause, not
   * three saying the same thing.
   */
  it("calls it the server when every site goes down together", () => {
    const { messages } = replay([all(200), all(522), all(522)]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("None of the 3 sites on this server can be reached");
    expect(messages[0]).toContain("the server itself");
    expect(messages[0]).toContain("liquiditywise.com (HTTP 522)");
    expect(messages[0]).toContain("splitstable.com (HTTP 522)");
  });

  /* The other outage, and the one that must not be mistaken for the first. */
  it("names one site, and says the server is up, when only it goes down", () => {
    const one = { ...all(200), "ensdesk.com": 502 };
    const { messages } = replay([all(200), one, one]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("ensdesk.com (HTTP 502)");
    expect(messages[0]).toContain("the server is up");
    expect(messages[0]).not.toContain("None of the");
  });

  it("names a missing answer as such, not as a status", () => {
    const { messages } = replay([all(null), all(null)]);

    expect(messages[0]).toContain("no answer at all");
  });

  it("reports one outage once, however long it lasts", () => {
    expect(replay([all(200), ...Array(10).fill(all(522))]).messages).toHaveLength(1);
  });

  it("says the whole server is back when every site returns together", () => {
    const { messages } = replay([all(200), all(522), all(522), all(200)]);

    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain("All the sites on this server are reachable");
  });

  it("names the one site that came back", () => {
    const one = { ...all(200), "ensdesk.com": 502 };
    const { messages } = replay([all(200), one, one, all(200)]);

    expect(messages[1]).toBe("✅ ensdesk.com is reachable from outside again.");
  });

  /*
   * One site down first, then the rest: the first message was right to call
   * it one site, and the second has to say what it has become — the server.
   */
  it("escalates from one site to the server as the others follow", () => {
    const one = { ...all(200), "ensdesk.com": 502 };
    const { messages } = replay([all(200), one, one, all(522), all(522)]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("the server is up");
    expect(messages[1]).toContain("the server itself");
  });

  /*
   * A Worker deployed while the server is already down has no memory of it
   * being up. It still has to say so — a monitor that stays quiet about an
   * outage it arrived in the middle of is no monitor at all.
   */
  it("reports an outage it arrives in the middle of", () => {
    expect(replay([all(522), all(522)]).messages).toHaveLength(1);
  });

  it("uses the single-site wording when it watches only one", () => {
    const only = [SITES[0]!];
    const { messages } = replay(
      [{ "liquiditywise.com": 522 }, { "liquiditywise.com": 522 }],
      only,
    );

    expect(messages[0]).not.toContain("None of the");
    expect(messages[0]).not.toContain("the server is up");
  });
});

describe("staying inside the store's write allowance", () => {
  /*
   * Workers KV on the free plan allows a thousand writes a day, and a check
   * every five minutes is 288 runs. So nothing is written while nothing
   * changes — which is every run on an ordinary day.
   */
  it("writes nothing while everything stays up", () => {
    expect(replay(Array(288).fill(all(200))).writes).toBe(0);
  });

  it("writes nothing more once an outage is established, however long", () => {
    // The first failure, then the step to down; after that every count is capped.
    expect(replay([all(200), ...Array(288).fill(all(522))]).writes).toBe(DOWN_AFTER_FAILURES);
  });
});

describe("reading what was stored", () => {
  it("reads back what it wrote", () => {
    const memory = { "ensdesk.com": { state: "down", failures: 2 } };

    expect(readFleetMemory(JSON.stringify(memory))).toEqual(memory);
  });

  /*
   * An unreadable entry for one site treats that site as never checked, and
   * keeps the others. Throwing the whole memory away would make every site's
   * outage look new again.
   */
  it("drops a bad entry and keeps the good ones", () => {
    const raw = JSON.stringify({
      "ensdesk.com": { state: "down", failures: 2 },
      "splitstable.com": { state: "sideways", failures: 0 },
    });

    expect(readFleetMemory(raw)).toEqual({ "ensdesk.com": { state: "down", failures: 2 } });
  });

  it.each([
    ["nothing", null],
    ["not JSON", "down"],
    ["a list", "[]"],
  ])("treats %s as nothing stored", (_label, raw) => {
    expect(readFleetMemory(raw)).toBeNull();
  });

  it.each([
    ["a negative count", { state: "up", failures: -1 }],
    ["a fractional count", { state: "up", failures: 1.5 }],
    ["a missing count", { state: "up" }],
  ])("refuses %s for a site", (_label, entry) => {
    expect(readFleetMemory(JSON.stringify({ "a.com": entry }))).toEqual({});
  });
});

describe("the sites it is told to watch", () => {
  it("reads a list of names and https addresses", () => {
    expect(readSites(JSON.stringify(SITES))).toEqual(SITES);
  });

  /*
   * Refused outright rather than partly used. A monitor quietly watching fewer
   * sites than it was configured with is one someone trusts for a site it has
   * stopped looking at.
   */
  it.each([
    ["an empty list", "[]"],
    ["not a list", '{"name":"a.com"}'],
    ["a site with no name", '[{"url":"https://a.com/"}]'],
    ["a plain-http address", '[{"name":"a.com","url":"http://a.com/"}]'],
  ])("refuses %s", (_label, raw) => {
    expect(() => readSites(raw)).toThrow();
  });
});
