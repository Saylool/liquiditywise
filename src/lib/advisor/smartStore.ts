import { z } from "zod";

import { V3PoolMetadataSchema } from "../../schemas";
import {
  appendTo,
  OWNER_SETS_MAX,
  ownerSetOf,
  OwnerSetSchema,
  type OwnerSet,
  SERIES_MAX,
  snapshotOf,
  SmartSnapshotSchema,
  type SmartSnapshot,
} from "../analytics/smartHistory";
import type { KeyValueStore } from "../store/keyValueStore";
import type { AddressKind } from "../uniswap/ethereumAddressKinds";
import type { SmartLiquidityRead } from "./readSmartLiquidity";

/*
 * What is kept of the smart-money measurements, and for how long.
 *
 * Three things per chain: the latest measurement in full, so a restart does
 * not send the next reader to wait half a minute for a new one; a series of
 * compact summaries, four weeks of them, for the trend; and a week of the
 * holders of the smart positions, for those that keep turning up.
 *
 * What is in it is public: pools, and the addresses of position holders, which
 * anybody can read off the chain and the page already lists. Nothing here says
 * anything about who reads the page, and none of it is a Telegram link.
 *
 * Every read answers `null` when the store did not, and every write says
 * whether it took; a failed write costs a chart a point and nothing else.
 */

const PREFIX = "liquiditywise:smart:";

/** A day and a bit: longer than the six hours a measurement is good for, so a restart finds one. */
export const LATEST_TTL_MS = 26 * 60 * 60 * 1_000;

/** Longer than the series can hold, so it is only gone once nothing has been written for weeks. */
export const SERIES_TTL_MS = 40 * 24 * 60 * 60 * 1_000;

const key = (chain: string, part: "latest" | "series" | "owners"): string => `${PREFIX}${chain}:${part}`;

const PositionSchema = z.object({
  pool: V3PoolMetadataSchema,
  tokenId: z.string(),
  owner: z.string(),
  valueUsd: z.number(),
  feesUsd: z.number(),
  days: z.number(),
  yearlyYield: z.number(),
  lowerPrice: z.number(),
  upperPrice: z.number(),
  currentPrice: z.number(),
});

const PairSchema = z.object({
  pool: V3PoolMetadataSchema,
  positions: z.number(),
  valueUsd: z.number(),
  medianLowerRatio: z.number(),
  medianUpperRatio: z.number(),
  medianLowerPrice: z.number(),
  medianUpperPrice: z.number(),
  medianYearlyYield: z.number(),
  currentPrice: z.number(),
});

const MeasuredReadSchema = z.object({
  status: z.literal("measured"),
  poolsAsked: z.number(),
  poolsRead: z.number(),
  measuredAt: z.string(),
  data: z.object({
    measured: z.number(),
    medianYearlyYield: z.number().nullable(),
    smartFrom: z.number().nullable(),
    smart: z.array(PositionSchema),
    pairs: z.array(PairSchema),
  }),
});

type Measured = Extract<SmartLiquidityRead, { status: "measured" }>;

const parse = <T>(raw: string | null | undefined, schema: z.ZodType<T>): T | null => {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** The latest measurement kept for a chain, or `null` when there is none, it is unreadable, or the store did not answer. */
export const readLatest = async (store: KeyValueStore, chain: string): Promise<Measured | null> =>
  parse(await store.get(key(chain, "latest")), MeasuredReadSchema) as Measured | null;

/** `null` when the store did not answer; an empty series when it did and there is none. */
export const readSeries = async (store: KeyValueStore, chain: string): Promise<readonly SmartSnapshot[] | null> => {
  const raw = await store.get(key(chain, "series"));
  if (raw === undefined) return null;
  return parse(raw, z.array(SmartSnapshotSchema)) ?? [];
};

export const readOwnerSets = async (store: KeyValueStore, chain: string): Promise<readonly OwnerSet[] | null> => {
  const raw = await store.get(key(chain, "owners"));
  if (raw === undefined) return null;
  return parse(raw, z.array(OwnerSetSchema)) ?? [];
};

/**
 * Keeps one measurement: the latest, the series, and — when the kinds of its
 * holders were read — the holders. A measurement whose kinds could not be read
 * still goes into the series; it just adds no holders, so an unread kind is
 * never counted as a wallet.
 */
export const recordMeasurement = async ({
  store,
  chain,
  read,
  kinds,
}: {
  readonly store: KeyValueStore;
  readonly chain: string;
  readonly read: Measured;
  readonly kinds: ReadonlyMap<string, AddressKind> | null;
}): Promise<{ readonly latest: boolean; readonly series: boolean; readonly owners: boolean }> => {
  const latest = await store.set(key(chain, "latest"), JSON.stringify(read), LATEST_TTL_MS);

  const before = await readSeries(store, chain);
  const series =
    before === null
      ? false
      : await store.set(
          key(chain, "series"),
          JSON.stringify(appendTo(before, snapshotOf(read.data, read.measuredAt), SERIES_MAX)),
          SERIES_TTL_MS,
        );

  let owners = false;
  if (kinds !== null) {
    const sets = await readOwnerSets(store, chain);
    owners =
      sets === null
        ? false
        : await store.set(
            key(chain, "owners"),
            JSON.stringify(appendTo(sets, ownerSetOf(read.data, read.measuredAt, kinds), OWNER_SETS_MAX)),
            SERIES_TTL_MS,
          );
  }

  return { latest, series, owners };
};
