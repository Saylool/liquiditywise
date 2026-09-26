import type { KeyValueStore } from "../store/keyValueStore";

/*
 * Whether the two paid credentials this application depends on still work.
 *
 * Both are silent when they fail. A Graph key past its quota, or an RPC
 * endpoint whose key was rotated, answers 401 to every read — the pages keep
 * rendering, each one saying it could not reach its source, and nobody tells
 * the person who could fix it. That is the fault this exists for, and it is
 * the one the health check was promised to cover and did not.
 *
 * Asked rather than waited for. The alternative — recording what real reads
 * happen to hit — costs nothing and reports only what a reader already
 * suffered, and on a quiet site the first report would come days late. A
 * question is worth its price here: one query an hour against a key that is
 * billed per query is under a thousand a month, beside a single pool page
 * that spends several.
 */

/** What a probe found. Only one of these is worth waking somebody for. */
export type UpstreamStatus = "ok" | "credentials-rejected" | "rate-limited" | "unreachable";

/**
 * The same reading both transports make of an HTTP status, kept in one place
 * because a monitor that disagreed with the application about what 403 means
 * would be worse than no monitor.
 *
 * 401 and 403 are the credential. Everything else is the provider having a
 * moment, which is not something the operator can act on and not something
 * this reports.
 */
export const classifyProbeStatus = (status: number): UpstreamStatus => {
  if (status === 200) return "ok";
  if (status === 401 || status === 403) return "credentials-rejected";
  if (status === 429) return "rate-limited";

  return "unreachable";
};

/** Where the last probe and its answer are kept, so the check is hourly and the report is not. */
const PROBE_KEY = "liquiditywise:health:upstream";

/** One an hour. Often enough to find a dead key the same morning; rare enough to be free. */
export const PROBE_INTERVAL_MS = 60 * 60 * 1_000;

/** The chains read beside mainnet, each probed on its own endpoint. */
export const OTHER_CHAINS = ["base", "arbitrum"] as const;
export type OtherChain = (typeof OTHER_CHAINS)[number];

export type UpstreamReport = {
  readonly marketData: UpstreamStatus;
  readonly chainData: UpstreamStatus;
  /**
   * What each other chain's RPC endpoint said, for the ones configured. Their
   * keys can be refused apart from mainnet's — a network switched off on the
   * provider's app refuses that network alone — so each is asked on its own.
   */
  readonly otherChains?: Partial<Record<OtherChain, UpstreamStatus>>;
  /** When these were taken, so a stale report can be told from a fresh one. */
  readonly atMs: number;
};

const parseReport = (raw: string | null | undefined): UpstreamReport | null => {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { marketData, chainData, atMs, otherChains } = parsed as Partial<UpstreamReport>;
    const known = (value: unknown): value is UpstreamStatus =>
      value === "ok" || value === "credentials-rejected" || value === "rate-limited" || value === "unreachable";

    /* A report stored before other chains has none of them, and reads as such. */
    const others: Partial<Record<OtherChain, UpstreamStatus>> = {};
    for (const chain of OTHER_CHAINS) {
      const status = (otherChains as Record<string, unknown> | undefined)?.[chain];
      if (known(status)) others[chain] = status;
    }

    return known(marketData) && known(chainData) && typeof atMs === "number"
      ? { marketData, chainData, otherChains: others, atMs }
      : null;
  } catch {
    return null;
  }
};

/** True when the last probe is old enough to be worth spending another query on. */
export const isProbeDue = (previous: UpstreamReport | null, nowMs: number): boolean =>
  previous === null || nowMs - previous.atMs >= PROBE_INTERVAL_MS;

export type ProbeDependencies = {
  /** Asks the market-data source; resolves to its HTTP status. */
  readonly probeMarketData: () => Promise<number>;
  /** Asks the chain source; resolves to its HTTP status. */
  readonly probeChainData: () => Promise<number>;
  /** One probe per other chain with an endpoint configured; the rest are simply not asked. */
  readonly probeOtherChains?: Partial<Record<OtherChain, () => Promise<number>>>;
  readonly now: () => Date;
};

/**
 * The stored report, refreshed at most once an hour.
 *
 * `null` when there is nothing to say: no store, or a store that cannot
 * answer and a probe that has not been made. A caller must not read that as
 * "everything is fine" — it is "nothing was asked" — which is why the health
 * readings leave the fields absent rather than filling them with "ok".
 */
export const readUpstreamReport = async (
  store: KeyValueStore | null,
  dependencies: ProbeDependencies,
): Promise<UpstreamReport | null> => {
  const nowMs = dependencies.now().getTime();
  const previous = store === null ? null : parseReport(await store.get(PROBE_KEY));

  if (!isProbeDue(previous, nowMs)) return previous;

  /*
   * Both at once, and neither allowed to fail the other: a Graph key that is
   * refused says nothing about the RPC endpoint, and a monitor that reported
   * one because of the other would send somebody to the wrong dashboard.
   */
  const others = OTHER_CHAINS.flatMap((chain) => {
    const probe = dependencies.probeOtherChains?.[chain];
    return probe === undefined ? [] : [{ chain, probe }];
  });
  const [marketStatus, chainStatus, ...otherStatuses] = await Promise.all([
    dependencies.probeMarketData().catch(() => 0),
    dependencies.probeChainData().catch(() => 0),
    ...others.map(({ probe }) => probe().catch(() => 0)),
  ]);

  const report: UpstreamReport = {
    marketData: classifyProbeStatus(marketStatus),
    chainData: classifyProbeStatus(chainStatus),
    otherChains: Object.fromEntries(
      others.map(({ chain }, index) => [chain, classifyProbeStatus(otherStatuses[index] ?? 0)]),
    ),
    atMs: nowMs,
  };

  // Best effort. A store that will not take it means the next pass probes
  // again, which costs another query and reports the same truth.
  if (store !== null) await store.set(PROBE_KEY, JSON.stringify(report), PROBE_INTERVAL_MS * 3);

  return report;
};
