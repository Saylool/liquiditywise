import type { Position } from "../../schemas";

/*
 * What changed between two readings of an address's positions.
 *
 * Pure. The checker reads the positions the same way the page does, keeps
 * only where each one stood against its range, and hands the last reading and
 * this one here. What comes out is the list of things worth a message —
 * and only those: a position that was inside and still is, is silence.
 *
 * The first reading is never a change. There is nothing to compare it with,
 * and a burst of "your position is out of range" on the day of linking would
 * be a list of facts the holder already knows.
 */

/**
 * Where each position stood, by a key that survives reordering: `true` inside
 * its range, `"near"` inside but close to an edge, `false` outside, `null` not
 * known. Links stored before `"near"` existed hold only the other three, and
 * read the same as before.
 */
export type PositionState = boolean | "near" | null;
export type PositionSnapshot = Readonly<Record<string, PositionState>>;

export type RangeEdge = "lower" | "upper";

export type PositionChange =
  | { readonly kind: "left" | "entered"; readonly position: Position }
  | { readonly kind: "nearing"; readonly position: Position; readonly edge: RangeEdge }
  | { readonly kind: "opened"; readonly position: Position }
  | { readonly kind: "closed"; readonly key: string };

/**
 * How close to an edge counts as close: a tenth of the range's own width, in
 * ticks. A share of the width rather than a fixed percentage of price, so a
 * tight range and a wide one are both warned with the same share of room
 * left — a fixed 5% would warn a ±3% range the moment it was opened, and a
 * full-range position never.
 */
export const NEAR_EDGE_SHARE = 0.1;

/**
 * How far back from the edge a position has to come before it is comfortable
 * again, and can be warned a second time: twice the first distance. A price
 * wandering around the line itself would otherwise send a warning with every
 * pass.
 */
export const CLEAR_OF_EDGE_SHARE = 0.2;

/** One protocol's token ids are not another's, so the protocol is part of the key. */
export const positionKey = (position: Position): string =>
  `${position.pool.protocolVersion}:${position.tokenId}`;

/** The edge the price is nearer to, and how far it is from it as a share of the range's width. */
export const nearestEdge = (position: Position): { readonly edge: RangeEdge; readonly share: number } | null => {
  if (position.currentTick === null) return null;
  const width = position.tickUpper - position.tickLower;
  const below = position.currentTick - position.tickLower;
  const above = position.tickUpper - position.currentTick;
  return below <= above ? { edge: "lower", share: below / width } : { edge: "upper", share: above / width };
};

/**
 * Where a position stands now, given where it stood before. Inside and within
 * a tenth of the width from an edge is near; once near, it stays near until it
 * is a fifth of the width away.
 */
export const positionState = (position: Position, previous: PositionState | undefined): PositionState => {
  if (position.inRange !== true) return position.inRange;
  const nearest = nearestEdge(position);
  if (nearest === null) return true;
  const limit = previous === "near" ? CLEAR_OF_EDGE_SHARE : NEAR_EDGE_SHARE;
  return nearest.share <= limit ? "near" : true;
};

export const snapshotOf = (positions: readonly Position[], previous: PositionSnapshot | null = null): PositionSnapshot =>
  Object.fromEntries(positions.map((position) => [positionKey(position), positionState(position, previous?.[positionKey(position)])]));

const inside = (state: PositionState): boolean | null => (state === null ? null : state !== false);

/**
 * The changes from `previous` to `current`.
 *
 * `previous === null` is the first reading, and yields none. A position whose
 * range status is unread on either side — the pool reported no tick — is
 * neither a leave nor an entry: "not known" is not a change from "inside".
 * Coming close to an edge is worth one message; going back towards the
 * middle is not.
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

    const before = previous[key] ?? null;
    const now = positionState(position, before);
    const wasInside = inside(before);
    const isInside = inside(now);
    if (wasInside === null || isInside === null) continue;

    if (wasInside !== isInside) {
      changes.push({ kind: isInside ? "entered" : "left", position });
    } else if (before === true && now === "near") {
      const nearest = nearestEdge(position);
      if (nearest !== null) changes.push({ kind: "nearing", position, edge: nearest.edge });
    }
  }

  for (const key of Object.keys(previous)) {
    if (!seen.has(key)) changes.push({ kind: "closed", key });
  }

  return changes;
};
