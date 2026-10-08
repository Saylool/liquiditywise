import { z } from "zod";

import { V3PoolMetadataSchema, V4PoolSchema } from "../../schemas";
import { isSupportedChainId } from "../chains/chains";
import type { KeyValueStore } from "../store/keyValueStore";
import type { MonthCasesRead } from "./readMonthCases";

/*
 * What is kept of a chain's cases: the latest measurement, in full, so a
 * restart finds it and no reader is shown "not yet measured" for the minutes
 * the warmer takes to get to that chain.
 *
 * Public, all of it — pools, prices and figures anybody can derive from the
 * chain, and nothing about who read the page. One key per chain, as the
 * smart-money store keeps its latest (smartStore.ts), and the same rule for
 * reads and writes: a read answers `null` when the store did not, and a
 * failed write costs a restart one cold chain and nothing else.
 */

const PREFIX = "liquiditywise:cases:";

/** A day and a bit: longer than the six hours a measurement is good for, so a restart finds one. */
export const CASES_LATEST_TTL_MS = 26 * 60 * 60 * 1_000;

const key = (chain: string): string => `${PREFIX}${chain}:latest`;

const ChainIdSchema = z.number().refine(isSupportedChainId);

const MonthCaseSchema = z.object({
  pool: z.union([V3PoolMetadataSchema, V4PoolSchema]),
  chainId: ChainIdSchema,
  currentPrice: z.number(),
  openedAt: z.string(),
  closedAt: z.string(),
  lowerPrice: z.number(),
  upperPrice: z.number(),
  inside: z.number(),
  outside: z.number(),
  crossed: z.number(),
  endValueVsHold: z.number(),
  depositUsd: z.number(),
  feesUsd: z.number(),
  feesOfDeposit: z.number(),
  resultVsHeldUsd: z.number(),
  recentres: z.number(),
  recentringDifferenceUsd: z.number(),
});

const MeasuredSchema = z.object({
  status: z.literal("measured"),
  chainId: ChainIdSchema,
  measuredAt: z.string(),
  poolsAsked: z.number(),
  cases: z.array(MonthCaseSchema),
});

export type MeasuredCases = Extract<MonthCasesRead, { status: "measured" }>;

/** The latest measurement kept for a chain, or `null` when there is none, it is unreadable, or the store did not answer. */
export const readLatestCases = async (store: KeyValueStore, chain: string): Promise<MeasuredCases | null> => {
  const raw = await store.get(key(chain));
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = MeasuredSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as MeasuredCases) : null;
  } catch {
    return null;
  }
};

/** Keeps one measurement as the chain's latest. `true` when the store took it. */
export const keepCases = (store: KeyValueStore, chain: string, read: MeasuredCases): Promise<boolean> =>
  store.set(key(chain), JSON.stringify(read), CASES_LATEST_TTL_MS);
