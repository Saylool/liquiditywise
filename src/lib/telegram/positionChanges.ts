import type { Position } from "../../schemas";

/*
 * What changed between two readings of an address's positions.
 *
 * Pure. The checker reads the positions the same way the page does, keeps
 * only whether each one was inside its range, and hands the last reading and
 * this one here. What comes out is the list of things worth a message —
 * and only those: a position that was inside and still is, is silence.
 *
 * The first reading is never a change. There is nothing to compare it with,
 * and a burst of "your position is out of range" on the day of linking would
 * be a list of facts the holder already knows.
 */

/** Whether each position was inside its range, by a key that survives reordering. */
export type PositionSnapshot = Readonly<Record<string, boolean | null>>;

export type PositionChange =
  | { readonly kind: "left" | "entered"; readonly position: Position }
  | { readonly kind: "opened"; readonly position: Position }
  | { readonly kind: "closed"; readonly key: string };

/** One protocol's token ids are not another's, so the protocol is part of the key. */
export const positionKey = (position: Position): string =>
  `${position.pool.protocolVersion}:${position.tokenId}`;

export const snapshotOf = (positions: readonly Position[]): PositionSnapshot =>
  Object.fromEntries(positions.map((position) => [positionKey(position), position.inRange]));

/**
 * The changes from `previous` to `current`.
 *
 * `previous === null` is the first reading, and yields none. A position whose
 * range status is unread on either side — the pool reported no tick — is
 * neither a leave nor an entry: "not known" is not a change from "inside".
 */
export const positionChanges = (
  previous: PositionSnapshot | null,
  current: readonly Position[],
): readonly PositionChange[] => {
  if (previous === null) return [];

  const changes: PositionChange[] = [];
  const seen = new Set<string>();

  for (const position of current) {
    const key = positionKey(position);
    seen.add(key);

    if (!(key in previous)) {
      changes.push({ kind: "opened", position });
      continue;
    }

    const before = previous[key];
    const now = position.inRange;
    if (typeof before !== "boolean" || typeof now !== "boolean" || before === now) continue;

    changes.push({ kind: now ? "entered" : "left", position });
  }

  for (const key of Object.keys(previous)) {
    if (!seen.has(key)) changes.push({ kind: "closed", key });
  }

  return changes;
};
