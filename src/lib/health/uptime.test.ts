import { describe, expect, it } from "vitest";

import {
  decideUptime,
  DOWN_AFTER_FAILURES,
  isReachable,
  readUptimeMemory,
  type UptimeMemory,
} from "./uptime";

const UP: UptimeMemory = { state: "up", failures: 0 };

/** Runs a sequence of answers through the decision, as the Worker would. */
const replay = (statuses: readonly (number | null)[]) => {
  let memory: UptimeMemory | null = null;
  const messages: string[] = [];
  let writes = 0;
  for (const status of statuses) {
    const decision = decideUptime(memory, status);
    if (decision.message !== null) messages.push(decision.message);
    if (decision.changed) writes += 1;
    memory = decision.memory;
  }
  return { memory, messages, writes };
};

describe("what counts as reachable", () => {
  /*
   * The probe asks the health route with no credentials, so a live app
   * answers 401. That is the app speaking, and it is exactly as good a sign
   * of life as a 200.
   */
  it("counts anything the application answers as reachable", () => {
    expect(isReachable(200)).toBe(true);
    expect(isReachable(401)).toBe(true);
    expect(isReachable(404)).toBe(true);
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

describe("saying something only when it matters", () => {
  it("stays silent while the site is up", () => {
    expect(replay([401, 401, 401]).messages).toEqual([]);
  });

  /*
   * The reason for the threshold. A deploy restarts the service for a few
   * seconds, one check can land in that gap, and a single failure reported as
   * an outage would be followed five minutes later by a recovery — two
   * messages after every deploy, which teaches the reader to skip the third.
   */
  it("says nothing about a single failed check between good ones", () => {
    expect(replay([401, 502, 401]).messages).toEqual([]);
  });

  it("reports an outage once the failures run to the threshold", () => {
    const { messages, memory } = replay([401, ...Array(DOWN_AFTER_FAILURES).fill(522)]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("cannot be reached from outside");
    expect(messages[0]).toContain("HTTP 522");
    expect(memory).toEqual({ state: "down", failures: DOWN_AFTER_FAILURES });
  });

  it("names a missing answer as such, not as a status", () => {
    const { messages } = replay([null, null]);

    expect(messages[0]).toContain("no answer at all");
  });

  it("reports an outage once, however long it lasts", () => {
    const { messages } = replay([401, 522, 522, 522, 522, 522, 522]);

    expect(messages).toHaveLength(1);
  });

  it("reports the recovery once, on the first good answer", () => {
    const { messages } = replay([401, 522, 522, 522, 401, 401]);

    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain("reachable from outside again");
  });

  /*
   * A Worker deployed while the site is already down has no memory of it
   * being up. It still has to say so — a monitor that stays quiet about an
   * outage it arrived in the middle of is no monitor at all.
   */
  it("reports an outage it arrives in the middle of", () => {
    expect(replay([522, 522]).messages).toHaveLength(1);
  });
});

describe("staying inside the store's write allowance", () => {
  /*
   * Workers KV on the free plan allows a thousand writes a day, and a check
   * every five minutes is 288 runs. So nothing is written while nothing
   * changes — which is every run on an ordinary day.
   */
  it("writes nothing while the site stays up", () => {
    expect(replay(Array(288).fill(401)).writes).toBe(0);
  });

  it("writes nothing more once an outage is established, however long", () => {
    const outage = replay([401, ...Array(288).fill(522)]);

    // The first failure, then the step to down; after that the count is capped.
    expect(outage.writes).toBe(DOWN_AFTER_FAILURES);
  });
});

describe("reading what was stored", () => {
  it("reads back what it wrote", () => {
    expect(readUptimeMemory(JSON.stringify({ state: "down", failures: 2 }))).toEqual({
      state: "down",
      failures: 2,
    });
  });

  /*
   * Anything else is treated as nothing stored. The cost of that is at most
   * one extra message; the cost of trusting junk could be a silenced outage.
   */
  it.each([
    ["nothing", null],
    ["not JSON", "down"],
    ["an unknown state", JSON.stringify({ state: "sideways", failures: 0 })],
    ["a negative count", JSON.stringify({ state: "up", failures: -1 })],
    ["a fractional count", JSON.stringify({ state: "up", failures: 1.5 })],
    ["a missing count", JSON.stringify({ state: "up" })],
  ])("treats %s as nothing stored", (_label, raw) => {
    expect(readUptimeMemory(raw)).toBeNull();
  });

  it("starts from up when nothing was stored", () => {
    expect(decideUptime(null, 401)).toEqual({ memory: UP, message: null, changed: false });
  });
});
