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
export const OTHER_CHAINS = ["base", "arbitrum", "unichain", "optimism", "polygon"] as const;
export type OtherChain = (typeof OTHER_CHAINS)[number];

/**
 * Every subgraph the pages read, each asked whether it still answers.
 *
 * A key probe cannot see this. The gateway answers 200 for a subgraph whose
 * only indexer has broken — with "bad indexers" in the body instead of data —
 * and every page reading it then says it cannot, while the key is fine. Base's
 * v4 subgraph did exactly that for a day, and nothing would have said so.
 */
export const SUBGRAPHS = [
  "v3-ethereum",
  "v3-base",
  "v3-arbitrum",
  "v3-optimism",
  "v3-polygon",
  "v4-ethereum",
  "v4-base",
  "v4-arbitrum",
  "v4-unichain",
  "v4-optimism",
  "v4-polygon",
  "v3-base-positions",
  "v3-optimism-positions",
] as const;
export type SubgraphName = (typeof SUBGRAPHS)[number];

/**
 * What a subgraph's own health field said. "unanswered" is a status other
 * than 200 — the key, a rate limit or the gateway, which the key probe
 * already covers — and is never reported here, so one refused key is one
 * message and not seven.
 */
export type SubgraphStatus = "ok" | "errors" | "indexing-errors" | "behind" | "unanswered";

/** An hour behind the chain is a subgraph that has stopped, not one that is slow. */
export const SUBGRAPH_LAG_LIMIT_MS = 60 * 60 * 1_000;

/** Reads one answer to `{ _meta { hasIndexingErrors block { timestamp } } }`. Pure. */
export const classifySubgraphAnswer = (httpStatus: number, body: unknown, nowMs: number): SubgraphStatus => {
  if (httpStatus !== 200 || typeof body !== "object" || body === null) return "unanswered";
  const { data, errors } = body as { data?: unknown; errors?: unknown };
  if (Array.isArray(errors) && errors.length > 0) return "errors";

  const meta = (data as { _meta?: { hasIndexingErrors?: unknown; block?: { timestamp?: unknown } } } | null | undefined)
    ?._meta;
  if (meta === undefined || meta === null) return "errors";
  if (meta.hasIndexingErrors === true) return "indexing-errors";

  const timestamp = meta.block?.timestamp;
  if (typeof timestamp === "number" && nowMs - timestamp * 1_000 > SUBGRAPH_LAG_LIMIT_MS) return "behind";

  return "ok";
};

/** One subgraph's reading, and since when it has been failing, carried from probe to probe. */
export type SubgraphReading = { readonly status: SubgraphStatus; readonly failingSinceMs: number | null };

const isFailing = (status: SubgraphStatus): boolean =>
  status === "errors" || status === "indexing-errors" || status === "behind";

export type UpstreamReport = {
  readonly marketData: UpstreamStatus;
  readonly chainData: UpstreamStatus;
  /**
   * What each other chain's RPC endpoint said, for the ones configured. Their
   * keys can be refused apart from mainnet's — a network switched off on the
   * provider's app refuses that network alone — so each is asked on its own.
   */
  readonly otherChains?: Partial<Record<OtherChain, UpstreamStatus>>;
  /** What each configured subgraph said, and since when it has been failing. */
  readonly subgraphs?: Partial<Record<SubgraphName, SubgraphReading>>;
  /** When these were taken, so a stale report can be told from a fresh one. */
  readonly atMs: number;
};

const parseReport = (raw: string | null | undefined): UpstreamReport | null => {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { marketData, chainData, atMs, otherChains, subgraphs } = parsed as Partial<UpstreamReport>;
    const known = (value: unknown): value is UpstreamStatus =>
      value === "ok" || value === "credentials-rejected" || value === "rate-limited" || value === "unreachable";

    /* A report stored before other chains has none of them, and reads as such. */
    const others: Partial<Record<OtherChain, UpstreamStatus>> = {};
    for (const chain of OTHER_CHAINS) {
      const status = (otherChains as Record<string, unknown> | undefined)?.[chain];
      if (known(status)) others[chain] = status;
    }

    /* Likewise a report stored before subgraphs were asked about. */
    const readings: Partial<Record<SubgraphName, SubgraphReading>> = {};
    for (const name of SUBGRAPHS) {
      const reading = (subgraphs as Record<string, Partial<SubgraphReading>> | undefined)?.[name];
      const status = reading?.status;
      const since = reading?.failingSinceMs;
      if (
        (status === "ok" || status === "unanswered" || (status !== undefined && isFailing(status))) &&
        (since === null || typeof since === "number")
      ) {
        readings[name] = { status, failingSinceMs: since };
      }
    }

    return known(marketData) && known(chainData) && typeof atMs === "number"
      ? { marketData, chainData, otherChains: others, subgraphs: readings, atMs }
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
  /** One question per configured subgraph: its HTTP status and decoded body. */
  readonly probeSubgraphs?: Partial<Record<SubgraphName, () => Promise<{ status: number; body: unknown }>>>;
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
  const asked = SUBGRAPHS.flatMap((name) => {
    const probe = dependencies.probeSubgraphs?.[name];
    return probe === undefined ? [] : [{ name, probe }];
  });
  const [[marketStatus, chainStatus, ...otherStatuses], answers] = await Promise.all([
    Promise.all([
      dependencies.probeMarketData().catch(() => 0),
      dependencies.probeChainData().catch(() => 0),
      ...others.map(({ probe }) => probe().catch(() => 0)),
    ]),
    Promise.all(asked.map(({ probe }) => probe().catch(() => ({ status: 0, body: null })))),
  ]);

  /* A failure keeps the moment it began, so a problem can wait for a second probe that agrees. */
  const subgraphs = Object.fromEntries(
    asked.map(({ name }, index) => {
      const answer = answers[index] ?? { status: 0, body: null };
      const status = classifySubgraphAnswer(answer.status, answer.body, nowMs);
      const failingSinceMs = isFailing(status) ? (previous?.subgraphs?.[name]?.failingSinceMs ?? nowMs) : null;
      return [name, { status, failingSinceMs }];
    }),
  );

  const report: UpstreamReport = {
    marketData: classifyProbeStatus(marketStatus),
    chainData: classifyProbeStatus(chainStatus),
    otherChains: Object.fromEntries(
      others.map(({ chain }, index) => [chain, classifyProbeStatus(otherStatuses[index] ?? 0)]),
    ),
    subgraphs,
    atMs: nowMs,
  };

  // Best effort. A store that will not take it means the next pass probes
  // again, which costs another query and reports the same truth.
  if (store !== null) await store.set(PROBE_KEY, JSON.stringify(report), PROBE_INTERVAL_MS * 3);

  return report;
};

/**
 * The subgraphs failing in a report, and for how long by its own clock. What
 * counts as long enough to tell somebody is problems.ts's to decide.
 */
export const subgraphFailures = (
  report: UpstreamReport,
): Partial<Record<SubgraphName, { readonly status: SubgraphStatus; readonly forMs: number }>> =>
  Object.fromEntries(
    SUBGRAPHS.flatMap((name) => {
      const reading = report.subgraphs?.[name];
      return reading === undefined || reading.failingSinceMs === null
        ? []
        : [[name, { status: reading.status, forMs: report.atMs - reading.failingSinceMs }]];
    }),
  );
