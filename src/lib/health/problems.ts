/*
 * What counts as something a person should be told about, and what does not.
 *
 * The line this file draws is "broken, and it will not fix itself". A
 * subgraph that timed out once is not on the list: the page says so, the next
 * request usually works, and a message about it teaches its reader to ignore
 * messages. A Redis that is not answering is, because nothing recovers from
 * it and the readers who linked a chat go quiet without being told.
 *
 * Pure, and it decides from readings rather than taking them. Some are the
 * application's own — whether the store answers, when the alert pass last
 * ran — and some can only be taken from outside it, by the script that
 * watches this machine. Both arrive here, so the thresholds and the wording
 * are in one tested place instead of half of them in a shell script.
 *
 * The wording is English, unlike everything else this project writes. These
 * sentences go to whoever runs the server, beside logs that are English, and
 * they name services and files that are English too. The ten languages are
 * for readers.
 */

import type { UpstreamStatus } from "./upstreamProbe";

/** Each problem has a stable id, so the same fault is not reported twice. */
export type ProblemId =
  | "store-unreachable"
  | "store-not-durable"
  | "alerts-not-running"
  | "certificate-expiring"
  | "disk-nearly-full"
  | "market-data-key-refused"
  | "chain-data-key-refused";

export type Problem = { readonly id: ProblemId; readonly message: string };

/** Everything the checks are decided from. Absent means "not measured". */
export type Readings = {
  /** Whether a value written to the store came back. */
  readonly storeAnswered?: boolean | undefined;
  /** Whether the store writes to disk as it goes, rather than hours later. */
  readonly storeDurable?: boolean | undefined;
  /**
   * When the scheduled alert pass last finished, in milliseconds since the
   * epoch, or `null` when it never has.
   */
  readonly lastAlertRunMs?: number | null | undefined;
  readonly nowMs?: number | undefined;
  /** Days until the TLS certificate expires. */
  readonly certificateDays?: number | undefined;
  /** Percentage of the filesystem in use. */
  readonly diskPercent?: number | undefined;
  /** What the subgraph gateway said to a probe, or absent when none was made. */
  readonly marketDataStatus?: UpstreamStatus | undefined;
  /** What the Ethereum RPC endpoint said to a probe. */
  readonly chainDataStatus?: UpstreamStatus | undefined;
};

/**
 * How long the alert pass may be silent before that is itself a fault.
 *
 * It runs every five minutes, so half an hour is six missed runs — long
 * enough that one slow or failed pass says nothing, short enough that a cron
 * entry somebody removed is found the same morning.
 */
export const ALERT_SILENCE_LIMIT_MS = 30 * 60 * 1_000;

/** Certbot renews at thirty days left. Ten means renewal has been failing. */
export const CERTIFICATE_WARNING_DAYS = 10;

/** Below this the machine still works; above it, something soon will not. */
export const DISK_WARNING_PERCENT = 90;

/**
 * The problems these readings show, worst first.
 *
 * A reading that was not taken produces no problem, which is what lets one
 * function serve a caller that can only see inside the application and a
 * caller that can only see the machine around it.
 */
export const problemsFrom = (readings: Readings): readonly Problem[] => {
  const problems: Problem[] = [];

  if (readings.storeAnswered === false) {
    problems.push({
      id: "store-unreachable",
      message:
        "Redis is not answering. Telegram links cannot be read or written and no alert will go out. Check `systemctl status redis-server`.",
    });
  }

  /*
   * Not an outage — the store is answering and the site works. It is a
   * promise that cannot be kept: a reader who links a chat is told so at
   * once, and without a log on disk that link is a restart away from being
   * lost with nothing to say so. Reported for the same reason as the rest,
   * that nobody would otherwise find out.
   */
  if (readings.storeDurable === false) {
    problems.push({
      id: "store-not-durable",
      message:
        "Redis is not writing an append-only log, so a Telegram link made in the last hour would not survive a restart. Run deploy/redis-durability.sh.",
    });
  }

  const { lastAlertRunMs, nowMs } = readings;
  if (lastAlertRunMs !== undefined && nowMs !== undefined) {
    /*
     * Never having run is not reported. Waiting for the first pass is the
     * ordinary state of a fresh deployment for five minutes, and a cron entry
     * that goes missing later shows up as a pass that has *stopped*.
     */
    const silentForMs = lastAlertRunMs === null ? 0 : nowMs - lastAlertRunMs;
    if (silentForMs > ALERT_SILENCE_LIMIT_MS) {
      const minutes = Math.round(silentForMs / 60_000);
      problems.push({
        id: "alerts-not-running",
        message: `The position-alert pass has not run for ${minutes} minutes. Check /etc/cron.d/liquiditywise and \`grep CRON /var/log/syslog\`.`,
      });
    }
  }

  const { certificateDays } = readings;
  if (certificateDays !== undefined && certificateDays < CERTIFICATE_WARNING_DAYS) {
    problems.push({
      id: "certificate-expiring",
      message: `The TLS certificate expires in ${certificateDays} days and certbot has not renewed it. Run \`certbot renew --dry-run\` to see why.`,
    });
  }

  /*
   * A refused key is the quietest way this application breaks. Every page
   * still renders, each one saying it could not reach its source, and the
   * only person who can fix it is the one nobody told. Rate limits and
   * unreachable providers are deliberately not here: those pass, and a
   * message about them would teach its reader to ignore the ones that do not.
   */
  if (readings.marketDataStatus === "credentials-rejected") {
    problems.push({
      id: "market-data-key-refused",
      message:
        "The Graph is refusing THE_GRAPH_API_KEY (401/403). Every pool page will say it cannot reach its source. Check the key's status and billing at thegraph.com/studio.",
    });
  }

  if (readings.chainDataStatus === "credentials-rejected") {
    problems.push({
      id: "chain-data-key-refused",
      message:
        "The Ethereum RPC endpoint is refusing ETHEREUM_RPC_URL (401/403). v4 pool pages cannot be shown at all, and v3 pages lose their tick spacing. Check the provider's dashboard.",
    });
  }

  const { diskPercent } = readings;
  if (diskPercent !== undefined && diskPercent > DISK_WARNING_PERCENT) {
    problems.push({
      id: "disk-nearly-full",
      message: `The filesystem is ${diskPercent}% full. This machine serves other sites too.`,
    });
  }

  return problems;
};
