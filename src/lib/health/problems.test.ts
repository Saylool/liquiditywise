import { describe, expect, it } from "vitest";

import {
  ALERT_SILENCE_LIMIT_MS,
  CERTIFICATE_WARNING_DAYS,
  DISK_WARNING_PERCENT,
  problemsFrom,
  type ProblemId,
  type Readings,
} from "./problems";

const ids = (readings: Readings): readonly ProblemId[] =>
  problemsFrom(readings).map((problem) => problem.id);

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 8, 22, 12, 0, 0);

describe("what a monitor is allowed to report", () => {
  /*
   * The property the whole arrangement rests on. One caller can see inside
   * the application and not the machine; the other can see the machine and
   * not inside. Both hand what they have to the same function, so a reading
   * nobody took has to be silence rather than a guess either way.
   */
  it("says nothing about a reading nobody took", () => {
    expect(problemsFrom({})).toEqual([]);
  });

  it("reports a store that does not answer", () => {
    expect(ids({ storeAnswered: false })).toEqual(["store-unreachable"]);
    expect(ids({ storeAnswered: true })).toEqual([]);
  });

  /*
   * The store can be answering perfectly and still be about to lose what it
   * was given. That is not an outage, and it is the only fault here that is
   * true of a machine where nothing has gone wrong yet — so it has to be
   * reported on its own rather than folded into the store being down.
   */
  it("reports a store that answers but does not write to disk", () => {
    expect(ids({ storeAnswered: true, storeDurable: false })).toEqual(["store-not-durable"]);
    expect(ids({ storeAnswered: true, storeDurable: true })).toEqual([]);
  });

  it("says nothing about durability nobody measured", () => {
    expect(ids({ storeAnswered: true })).toEqual([]);
  });

  it("points at the script that fixes it, since the reader will not guess", () => {
    const [problem] = problemsFrom({ storeDurable: false });

    expect(problem?.message).toContain("redis-durability.sh");
  });

  it("names the service to look at, because the message is all the reader gets", () => {
    const [problem] = problemsFrom({ storeAnswered: false });

    expect(problem?.message).toContain("redis-server");
  });
});

describe("an alert pass that has stopped", () => {
  it("is not reported before the first one has run", () => {
    expect(ids({ lastAlertRunMs: null, nowMs: NOW })).toEqual([]);
  });

  it("is not reported for a single missed pass", () => {
    expect(ids({ lastAlertRunMs: NOW - 10 * MINUTE, nowMs: NOW })).toEqual([]);
  });

  it("is reported once it has been silent past the limit", () => {
    expect(ids({ lastAlertRunMs: NOW - ALERT_SILENCE_LIMIT_MS - 1, nowMs: NOW })).toEqual([
      "alerts-not-running",
    ]);
  });

  /*
   * Exactly at the limit is not a fault. Cron fires on the minute and this
   * check runs on the minute too, so a pass that is thirty minutes old to the
   * millisecond is the boundary an ordinary schedule lands on, not a failure.
   */
  it("allows a pass that is exactly as old as the limit", () => {
    expect(ids({ lastAlertRunMs: NOW - ALERT_SILENCE_LIMIT_MS, nowMs: NOW })).toEqual([]);
  });

  it("says how long it has been, since that is what tells a stall from an outage", () => {
    const [problem] = problemsFrom({ lastAlertRunMs: NOW - 95 * MINUTE, nowMs: NOW });

    expect(problem?.message).toContain("95 minutes");
  });

  /*
   * A clock that has gone backwards — the reading is from the future — must
   * not read as a very old pass. Subtraction gives a negative number here,
   * and negative is quiet, which is the right answer: nothing is known to be
   * wrong with the schedule.
   */
  it("is quiet when the last run is in the future", () => {
    expect(ids({ lastAlertRunMs: NOW + 60 * MINUTE, nowMs: NOW })).toEqual([]);
  });

  it("needs both halves of the reading before it judges", () => {
    expect(ids({ lastAlertRunMs: 0 })).toEqual([]);
    expect(ids({ nowMs: NOW })).toEqual([]);
  });
});

describe("a certificate running out", () => {
  it("is reported inside the warning window", () => {
    expect(ids({ certificateDays: CERTIFICATE_WARNING_DAYS - 1 })).toEqual(["certificate-expiring"]);
  });

  /*
   * Certbot renews with thirty days left, so anything above the window is a
   * certificate being managed normally. Reporting those would mean a message
   * every day about a machine that is fine.
   */
  it("is not reported while certbot still has room to renew", () => {
    expect(ids({ certificateDays: CERTIFICATE_WARNING_DAYS })).toEqual([]);
    expect(ids({ certificateDays: 30 })).toEqual([]);
  });

  it("is reported for a certificate that has already expired", () => {
    expect(ids({ certificateDays: 0 })).toEqual(["certificate-expiring"]);
    expect(ids({ certificateDays: -3 })).toEqual(["certificate-expiring"]);
  });
});

describe("a filesystem filling up", () => {
  it("is reported above the threshold and not at it", () => {
    expect(ids({ diskPercent: DISK_WARNING_PERCENT + 1 })).toEqual(["disk-nearly-full"]);
    expect(ids({ diskPercent: DISK_WARNING_PERCENT })).toEqual([]);
  });

  /* The machine is shared, so the message has to say whose problem it is. */
  it("says the machine is not ours alone", () => {
    const [problem] = problemsFrom({ diskPercent: 95 });

    expect(problem?.message).toContain("other sites");
  });
});

describe("several faults at once", () => {
  /*
   * An outage rarely arrives alone — a full disk stops Redis writing, which
   * stops the alert pass. All three go out, worst first, because being told
   * only about the store would send someone to restart the wrong thing.
   */
  it("reports every one of them, worst first", () => {
    expect(
      ids({
        storeAnswered: false,
        storeDurable: false,
        lastAlertRunMs: NOW - 3 * ALERT_SILENCE_LIMIT_MS,
        nowMs: NOW,
        certificateDays: 2,
        diskPercent: 99,
      }),
    ).toEqual([
      "store-unreachable",
      "store-not-durable",
      "alerts-not-running",
      "certificate-expiring",
      "disk-nearly-full",
    ]);
  });

  it("gives every problem an id of its own, so none can mask another", () => {
    const reported = ids({ storeAnswered: false, certificateDays: 1, diskPercent: 99 });

    expect(new Set(reported).size).toBe(reported.length);
  });
});
