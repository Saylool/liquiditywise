/*
 * Whether the sites on this server can be reached from outside it, judged
 * from outside it.
 *
 * The health check on the server covers everything short of one thing: the
 * machine being off. A process cannot report its own death, and neither can
 * anything else running beside it. This is the other half — run by a
 * Cloudflare Worker on Cloudflare's machines, which keep running when ours
 * does not, and which these sites are already served through.
 *
 * It watches every site the server hosts, not only this one, because that is
 * what lets it tell two different outages apart. One site unreachable while
 * the others answer is that site's problem, and the server is up. All of them
 * unreachable at once is the server, or its network — which is the outage
 * nothing on the server can report.
 *
 * Pure. The Worker asks each site, hands the answers here with what it knew
 * last time, and gets back what to remember and whether to say anything.
 */

export type UptimeState = "up" | "down";

/** What is remembered about one site between runs. */
export type UptimeMemory = {
  readonly state: UptimeState;
  /** Failed checks in a row, capped once the site is declared down. */
  readonly failures: number;
};

/**
 * How many failed checks in a row before a site is called down.
 *
 * Two, at one check every five minutes: an outage is reported within about
 * ten. One would be faster and wrong. Every deployment restarts a service for
 * a few seconds, a check that lands in that gap fails, and a single failure
 * counted as an outage would send "down" and then "recovered" after every
 * deploy — two messages that teach the reader to ignore the third.
 */
export const DOWN_AFTER_FAILURES = 2;

const FRESH: UptimeMemory = { state: "up", failures: 0 };

/**
 * Whether one answer means a site is reachable.
 *
 * Anything a site itself sends back — a 200, the 401 an unauthenticated health
 * probe gets, a redirect to a login page — proves it is running and reached.
 * A 5xx is Cloudflare saying the origin did not answer (the 520s) or nginx
 * saying the app behind it did not (502), and `null` is no answer at all.
 */
export const isReachable = (status: number | null): boolean =>
  status !== null && status > 0 && status < 500;

export type SiteDecision = {
  readonly memory: UptimeMemory;
  readonly changed: boolean;
  /** Which way the site crossed the line on this run, if it did. */
  readonly became: UptimeState | null;
};

/** One site's run, with no words in it: the fleet decides what to say. */
export const decideSite = (previous: UptimeMemory | null, status: number | null): SiteDecision => {
  const before = previous ?? FRESH;

  if (isReachable(status)) {
    return {
      memory: FRESH,
      changed: before.state !== "up" || before.failures !== 0,
      became: before.state === "down" ? "up" : null,
    };
  }

  /*
   * Capped at the threshold: once a site is down there is nothing more to
   * count, and a number that kept climbing would be a write on every run of
   * an outage — against a store that allows a thousand a day.
   */
  const failures = Math.min(before.failures + 1, DOWN_AFTER_FAILURES);
  const state: UptimeState = failures >= DOWN_AFTER_FAILURES ? "down" : before.state;

  return {
    memory: { state, failures },
    changed: before.state !== state || before.failures !== failures,
    became: before.state === "up" && state === "down" ? "down" : null,
  };
};

/** A site to watch: the name a message uses, and the address to ask. */
export type Site = { readonly name: string; readonly url: string };

export type FleetMemory = Readonly<Record<string, UptimeMemory>>;

export type FleetDecision = {
  readonly memory: FleetMemory;
  readonly changed: boolean;
  /** Lines for the operator, or `null` when nothing changed. */
  readonly message: string | null;
};

const describe = (status: number | null): string =>
  status === null ? "no answer at all" : `HTTP ${status}`;

const list = (names: readonly string[]): string => names.join(", ");

export const decideFleet = (
  sites: readonly Site[],
  previous: FleetMemory | null,
  statuses: Readonly<Record<string, number | null>>,
): FleetDecision => {
  const memory: Record<string, UptimeMemory> = {};
  const wentDown: string[] = [];
  const cameBack: string[] = [];
  let changed = false;

  for (const site of sites) {
    const status = statuses[site.name] ?? null;
    const decision = decideSite(previous?.[site.name] ?? null, status);
    memory[site.name] = decision.memory;
    if (decision.changed) changed = true;
    if (decision.became === "down") wentDown.push(`${site.name} (${describe(status)})`);
    if (decision.became === "up") cameBack.push(site.name);
  }

  const allDown = sites.length > 0 && sites.every((site) => memory[site.name]?.state === "down");
  const allUp = sites.every((site) => memory[site.name]?.state === "up");
  const lines: string[] = [];

  if (wentDown.length > 0) {
    /*
     * The distinction this watches several sites to make. When every one of
     * them is down together, the likeliest cause is the thing they share —
     * the server, or the network in front of it — and that is the message
     * worth sending, rather than one per site saying the same thing three
     * times.
     */
    if (allDown && sites.length > 1) {
      lines.push(
        `⚠️ None of the ${sites.length} sites on this server can be reached from outside: ${list(wentDown)}, ${DOWN_AFTER_FAILURES} checks in a row. They share one machine, so the server itself — or its network — is probably down. This check runs on Cloudflare, not on the server, which is why it can still say so.`,
      );
    } else if (allDown) {
      lines.push(
        `⚠️ ${list(wentDown)} cannot be reached from outside, ${DOWN_AFTER_FAILURES} checks in a row. This check runs on Cloudflare, not on the server, which is why it can still say so.`,
      );
    } else {
      lines.push(
        `⚠️ ${list(wentDown)} cannot be reached from outside, ${DOWN_AFTER_FAILURES} checks in a row. The other sites on the same server still answer, so the server is up — the problem is this site.`,
      );
    }
  }

  if (cameBack.length > 0) {
    lines.push(
      allUp && sites.length > 1 && cameBack.length === sites.length
        ? "✅ All the sites on this server are reachable from outside again."
        : `✅ ${list(cameBack)} is reachable from outside again.`,
    );
  }

  return { memory, changed, message: lines.length === 0 ? null : lines.join("\n\n") };
};

const readSiteMemory = (value: unknown): UptimeMemory | null => {
  if (typeof value !== "object" || value === null) return null;
  const { state, failures } = value as Partial<UptimeMemory>;

  return (state === "up" || state === "down") &&
    typeof failures === "number" &&
    Number.isInteger(failures) &&
    failures >= 0
    ? { state, failures }
    : null;
};

/**
 * What was stored, read defensively. An entry that is not a memory this code
 * wrote is dropped, which treats that one site as never checked: the cost is
 * at most one extra message about it, and never a silenced one.
 */
export const readFleetMemory = (raw: string | null): FleetMemory | null => {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const memory: Record<string, UptimeMemory> = {};
    for (const [name, value] of Object.entries(parsed)) {
      const site = readSiteMemory(value);
      if (site !== null) memory[name] = site;
    }
    return memory;
  } catch {
    return null;
  }
};

/**
 * The sites to watch, as the Worker is configured with them. Anything that is
 * not a list of names and https addresses is refused outright rather than
 * partly used: a monitor quietly watching fewer sites than it was told to is
 * a monitor someone trusts for a site it has stopped looking at.
 */
export const readSites = (raw: string): readonly Site[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("SITES must be a non-empty list");

  return parsed.map((entry: unknown) => {
    const { name, url } = (entry ?? {}) as Partial<Site>;
    if (typeof name !== "string" || name.length === 0 || typeof url !== "string" || !url.startsWith("https://")) {
      throw new Error("each site needs a name and an https url");
    }
    return { name, url };
  });
};
