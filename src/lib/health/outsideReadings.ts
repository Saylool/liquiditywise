import { z } from "zod";

import type { Readings } from "./problems";

/*
 * The readings taken outside the application, on their way in.
 *
 * A shell script measured these and put them in a query string, so they
 * arrive as text that may be anything. What matters here is the difference
 * between a reading that is absent and a reading that is zero: absent means
 * nobody looked, and zero is often the answer worth reporting.
 */

/**
 * Durability is matched exactly rather than coerced.
 *
 * `z.coerce.boolean()` follows JavaScript, where every non-empty string is
 * true — including `"0"`. That would read a Redis with no append-only log as
 * a durable one and silently drop the only case this reading exists for.
 */
const OutsideSchema = z.object({
  /** Negative once a certificate has expired, which is still worth reporting. */
  certificateDays: z.coerce.number().int().min(-3650).max(3650).optional(),
  diskPercent: z.coerce.number().int().min(0).max(100).optional(),
  backupHours: z.coerce.number().int().min(0).max(1_000_000).optional(),
  storeDurable: z
    .enum(["0", "1"])
    .transform((value) => value === "1")
    .optional(),
});

/** A query parameter that is not there stays not there, rather than becoming "". */
const given = (value: string | null): string | undefined => value ?? undefined;

/**
 * Anything unreadable is dropped rather than refused.
 *
 * This route answers while something is wrong. A `df` that printed something
 * unexpected must not cost the operator the readings that did arrive, and a
 * monitor that returns an error instead of a verdict has failed at its one
 * job.
 */
export const readOutsideReadings = (searchParams: URLSearchParams): Readings => {
  const parsed = OutsideSchema.safeParse({
    certificateDays: given(searchParams.get("certificateDays")),
    diskPercent: given(searchParams.get("diskPercent")),
    backupHours: given(searchParams.get("backupHours")),
    storeDurable: given(searchParams.get("storeDurable")),
  });

  return parsed.success ? parsed.data : {};
};
