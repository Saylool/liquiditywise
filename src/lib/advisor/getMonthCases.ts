import "server-only";

import { processShared } from "../cache/processShared";
import { type ChainId, chainOf } from "../chains/chains";
import { openConfiguredStore } from "../store/openStore";
import { keepCases, readLatestCases } from "./casesStore";
import { getMostTraded } from "./getMostTraded";
import { getPoolRangeAnalysis } from "./getPoolRangeAnalysis";
import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";
import { type MonthCasesRead, readMonthCases } from "./readMonthCases";

const LABEL = "month-cases";

/** Kept seven hours, and read anew every six by the warmer, so no reader waits on the read. */
export const MONTH_CASES_TTL_MS = 7 * 60 * 60 * 1000;
export const MONTH_CASES_WARM_EVERY_MS = 6 * 60 * 60 * 1000;
/**
 * After the lists' first round and the histories' (warmPoolHistories.ts), so
 * the two dozen analyses a chain costs find their slowest read already kept.
 */
export const MONTH_CASES_FIRST_WARM_AFTER_MS = 4 * 60 * 1000;

/*
 * One chain's cases, shared with the warmer (see processShared.ts). A read is
 * up to two dozen pool analyses — each three reads, the history the slowest —
 * so it is kept for hours and started only by the warmer. The page never
 * starts one: it shows what is kept, or says nothing is yet.
 */
const cached = processShared(
  "month-cases",
  () => new Map<ChainId, { readonly value: MonthCasesRead; readonly writtenAt: number }>(),
);
const running = processShared("month-cases.running", () => new Map<ChainId, Promise<MonthCasesRead>>());

/** For tests. */
export const forgetMonthCases = (): void => {
  cached.clear();
  running.clear();
};

const readNow = (chainId: ChainId): Promise<MonthCasesRead> =>
  readMonthCases(chainId, {
    listPools: () => getMostTraded(chainId),
    analyse: ({ protocolVersion, id }) =>
      getPoolRangeAnalysis(protocolVersion, id, DEFAULT_PRICE_BAND_PARAMETERS, DEFAULT_DEPOSIT_USD, undefined, chainId),
    now: () => new Date(),
  });

/** Keeps a measurement past this process. Never waited for and never throws. */
const persist = async (chainId: ChainId, read: Extract<MonthCasesRead, { status: "measured" }>): Promise<void> => {
  const store = openConfiguredStore();
  if (store === null) return;
  try {
    const kept = await keepCases(store, chainOf(chainId).slug, read);
    if (!kept) console.warn(`[${LABEL}] kept chain=${chainId} failed`);
  } catch {
    console.warn(`[${LABEL}] kept chain=${chainId} failed`);
  }
};

const fresh = (hit: { readonly writtenAt: number } | undefined): boolean =>
  hit !== undefined && Date.now() - hit.writtenAt < MONTH_CASES_TTL_MS;

/**
 * Puts the measurement kept in the store back in the cache, when there is one
 * still good and nothing newer: what makes a restart cost readers nothing.
 * `true` when it did.
 */
export const hydrateMonthCases = async (chainId: ChainId): Promise<boolean> => {
  if (cached.has(chainId)) return false;
  const store = openConfiguredStore();
  if (store === null) return false;

  try {
    const kept = await readLatestCases(store, chainOf(chainId).slug);
    if (kept === null) return false;
    const measuredAt = Date.parse(kept.measuredAt);
    if (!(Date.now() - measuredAt < MONTH_CASES_TTL_MS && measuredAt <= Date.now())) return false;
    if (cached.has(chainId)) return false;

    cached.set(chainId, { value: kept, writtenAt: measuredAt });
    return true;
  } catch {
    return false;
  }
};

/**
 * What is kept for a chain — in this process, or failing that in the store —
 * and never a read. For the page: `null` until the warmer's first round has
 * measured the chain, which the page says as "not yet measured" rather than
 * spending two dozen analyses on a visit.
 */
export const getKeptMonthCases = async (chainId: ChainId): Promise<MonthCasesRead | null> => {
  const hit = cached.get(chainId);
  if (fresh(hit)) return hit!.value;

  const store = openConfiguredStore();
  if (store === null) return null;
  try {
    const kept = await readLatestCases(store, chainOf(chainId).slug);
    if (kept === null) return null;
    const measuredAt = Date.parse(kept.measuredAt);
    return Date.now() - measuredAt < MONTH_CASES_TTL_MS ? kept : null;
  } catch {
    return null;
  }
};

/**
 * Reads a chain anew, for the warmer, and keeps what it measured; a read that
 * fails leaves the kept one to serve until it runs out. Readers who arrive
 * while one is running wait on that one rather than starting their own.
 */
export const getMonthCases = async (
  chainId: ChainId,
  { refresh = false }: { readonly refresh?: boolean } = {},
): Promise<MonthCasesRead> => {
  const hit = cached.get(chainId);
  if (!refresh && fresh(hit)) return hit!.value;

  const inFlight = running.get(chainId);
  if (inFlight !== undefined) return inFlight;

  const started = Date.now();
  const reading = readNow(chainId)
    .then((value) => {
      if (value.status === "measured") {
        cached.set(chainId, { value, writtenAt: Date.now() });
        void persist(chainId, value);
      }
      console.info(
        value.status === "measured"
          ? `[${LABEL}] chain=${chainId} cases=${value.cases.length} pools=${value.poolsAsked} ${Date.now() - started}ms`
          : `[${LABEL}] chain=${chainId} unavailable (${value.notice}) ${Date.now() - started}ms`,
      );
      /* A failed read gives way to the one kept, while it lasts. */
      return value.status === "measured" || !fresh(hit) ? value : hit!.value;
    })
    .finally(() => running.delete(chainId));
  running.set(chainId, reading);
  return reading;
};
