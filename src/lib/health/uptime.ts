/*
 * Whether the site can be reached from outside it, judged from outside it.
 *
 * The health check on the server covers everything short of one thing: the
 * machine being off. A process cannot report its own death, and neither can
 * anything else running beside it. This is the other half — run by a
 * Cloudflare Worker on Cloudflare's machines, which keep running when ours
 * does not, and which the site is already served through.
 *
 * Pure. The Worker asks the site, hands the answer here with what it knew
 * last time, and gets back what to remember and whether to say anything.
 */

export type UptimeState = "up" | "down";

/** What the Worker remembers between runs. Absent before its first. */
export type UptimeMemory = {
  readonly state: UptimeState;
  /** Failed checks in a row, capped once the site is declared down. */
  readonly failures: number;
};

/**
 * How many failed checks in a row before the site is called down.
 *
 * Two, at one check every five minutes: an outage is reported within about
 * ten. One would be faster and wrong. Every deployment restarts the service
 * for a few seconds, a check that lands in that gap fails, and a single
 * failure counted as an outage would send "down" and then "recovered" after
 * every deploy — two messages that teach the reader to ignore the third.
 */
export const DOWN_AFTER_FAILURES = 2;

const FRESH: UptimeMemory = { state: "up", failures: 0 };

/**
 * Whether one answer means the site is reachable.
 *
 * Anything the application itself sends back — 200, or the 401 an
 * unauthenticated health probe gets — proves it is running and reached.
 * A 5xx is Cloudflare saying the origin did not answer (the 520s) or nginx
 * saying the app behind it did not (502), and `null` is no answer at all.
 */
export const isReachable = (status: number | null): boolean =>
  status !== null && status > 0 && status < 500;

export type UptimeDecision = {
  readonly memory: UptimeMemory;
  /** A line for the operator, or `null` when nothing changed. */
  readonly message: string | null;
  /** Whether `memory` differs from what was stored, so a write is owed. */
  readonly changed: boolean;
};

const describe = (status: number | null): string =>
  status === null ? "no answer at all" : `HTTP ${status}`;

export const decideUptime = (
  previous: UptimeMemory | null,
  status: number | null,
): UptimeDecision => {
  const before = previous ?? FRESH;

  if (isReachable(status)) {
    const memory = FRESH;
    const changed = before.state !== memory.state || before.failures !== memory.failures;

    return {
      memory,
      changed,
      message:
        before.state === "down"
          ? "✅ liquiditywise.com is reachable from outside again."
          : null,
    };
  }

  /*
   * Capped at the threshold: once the site is down there is nothing more to
   * count, and a number that kept climbing would be a write on every run of
   * an outage — against a store that allows a thousand a day.
   */
  const failures = Math.min(before.failures + 1, DOWN_AFTER_FAILURES);
  const state: UptimeState = failures >= DOWN_AFTER_FAILURES ? "down" : before.state;
  const memory: UptimeMemory = { state, failures };
  const changed = before.state !== state || before.failures !== failures;

  return {
    memory,
    changed,
    message:
      before.state === "up" && state === "down"
        ? `⚠️ liquiditywise.com cannot be reached from outside (${describe(status)}, ${DOWN_AFTER_FAILURES} checks in a row). This check runs on Cloudflare, not on the server, so it is the one that still works when the machine itself is off.`
        : null,
  };
};

/**
 * What was stored, read defensively. Anything that is not a memory this code
 * wrote is treated as nothing stored, which costs at most one extra message
 * and never a silenced one.
 */
export const readUptimeMemory = (raw: string | null): UptimeMemory | null => {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { state, failures } = parsed as Partial<UptimeMemory>;

    return (state === "up" || state === "down") &&
      typeof failures === "number" &&
      Number.isInteger(failures) &&
      failures >= 0
      ? { state, failures }
      : null;
  } catch {
    return null;
  }
};
