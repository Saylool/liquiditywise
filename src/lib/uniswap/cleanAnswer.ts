/**
 * Whether a subgraph answer is one worth keeping: data, no errors beside it,
 * and an indexer that reports none of its own.
 *
 * The day-table caches keep a read for ten minutes, and "the request
 * succeeded" is not this. The gateway answers 200 with `errors` when an
 * indexer is bad — seen on Base on 2026-09-26 — and a cache that kept that
 * answer served every page built on it a refusal for ten minutes after the
 * source had recovered, where not keeping it would have cost one more read.
 */
export const isCleanAnswer = (payload: unknown): boolean => {
  if (typeof payload !== "object" || payload === null) return false;
  const { data, errors } = payload as { data?: unknown; errors?: unknown };
  if (Array.isArray(errors) && errors.length > 0) return false;
  if (typeof data !== "object" || data === null) return false;
  const meta = (data as { _meta?: { hasIndexingErrors?: unknown } | null })._meta;
  return meta?.hasIndexingErrors !== true;
};
