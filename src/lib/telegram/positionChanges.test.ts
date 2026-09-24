import { describe, expect, it } from "vitest";

import type { Position } from "../../schemas";
import {
  CLEAR_OF_EDGE_SHARE,
  NEAR_EDGE_SHARE,
  nearestEdge,
  positionChanges,
  positionKey,
  positionState,
  snapshotOf,
} from "./positionChanges";

/** Enough of a position for the comparison: which one it is, and whether it is inside. */
const position = (
  protocolVersion: "v3" | "v4",
  tokenId: string,
  inRange: boolean | null,
): Position =>
  ({
    tokenId,
    pool: { protocolVersion, id: `pool-${tokenId}` },
    inRange,
  }) as unknown as Position;

describe("positionChanges", () => {
  it("reports nothing on the first reading", () => {
    expect(positionChanges(null, [position("v3", "1", false), position("v4", "2", true)])).toEqual([]);
  });

  it("reports a position that left its range, and one that came back", () => {
    const previous = snapshotOf([position("v3", "1", true), position("v3", "2", false)]);
    const current = [position("v3", "1", false), position("v3", "2", true)];

    expect(positionChanges(previous, current)).toEqual([
      { kind: "left", position: current[0] },
      { kind: "entered", position: current[1] },
    ]);
  });

  it("is silent about a position that stayed where it was", () => {
    const previous = snapshotOf([position("v3", "1", true), position("v3", "2", false)]);
    expect(positionChanges(previous, [position("v3", "1", true), position("v3", "2", false)])).toEqual([]);
  });

  it("does not call an unread status a change, in either direction", () => {
    expect(positionChanges(snapshotOf([position("v3", "1", true)]), [position("v3", "1", null)])).toEqual([]);
    expect(positionChanges(snapshotOf([position("v3", "1", null)]), [position("v3", "1", false)])).toEqual([]);
  });

  it("reports a new position and a closed one", () => {
    const previous = snapshotOf([position("v3", "1", true)]);
    const opened = position("v4", "9", true);

    expect(positionChanges(previous, [opened])).toEqual([
      { kind: "opened", position: opened },
      { kind: "closed", key: "v3:1" },
    ]);
  });

  it("keeps the two protocols' token ids apart", () => {
    expect(positionKey(position("v3", "7", true))).toBe("v3:7");
    expect(positionKey(position("v4", "7", true))).toBe("v4:7");

    const previous = snapshotOf([position("v3", "7", true)]);
    expect(positionChanges(previous, [position("v4", "7", true)])).toEqual([
      { kind: "opened", position: position("v4", "7", true) },
      { kind: "closed", key: "v3:7" },
    ]);
  });

  it("snapshots by key, keeping the unread status as null", () => {
    expect(snapshotOf([position("v3", "1", true), position("v4", "2", null)])).toEqual({
      "v3:1": true,
      "v4:2": null,
    });
  });
});

/** A position ranging over ticks 0 to 1000, with the pool at `tick`. */
const ranged = (tick: number | null, tokenId = "1"): Position =>
  ({
    tokenId,
    pool: { protocolVersion: "v3", id: `pool-${tokenId}` },
    tickLower: 0,
    tickUpper: 1_000,
    currentTick: tick,
    inRange: tick === null ? null : tick >= 0 && tick < 1_000,
  }) as unknown as Position;

describe("coming close to an edge", () => {
  it("counts a tenth of the width from either edge as near, and no further", () => {
    expect(positionState(ranged(100), true)).toBe("near");
    expect(positionState(ranged(101), true)).toBe(true);
    expect(positionState(ranged(900), true)).toBe("near");
    expect(positionState(ranged(899), true)).toBe(true);
    expect(positionState(ranged(500), undefined)).toBe(true);
    expect(NEAR_EDGE_SHARE).toBe(0.1);
  });

  it("stays near until a fifth of the width away, so a price on the line does not warn every pass", () => {
    expect(positionState(ranged(200), "near")).toBe("near");
    expect(positionState(ranged(201), "near")).toBe(true);
    expect(CLEAR_OF_EDGE_SHARE).toBe(0.2);
  });

  it("is outside or unknown, whatever came before, when the range says so", () => {
    expect(positionState(ranged(1_200), "near")).toBe(false);
    expect(positionState(ranged(null), true)).toBeNull();
  });

  it("warns once, with the edge, when a comfortable position comes close", () => {
    const previous = snapshotOf([ranged(500)]);
    const current = [ranged(950)];

    expect(positionChanges(previous, current)).toEqual([{ kind: "nearing", position: current[0], edge: "upper" }]);
    expect(positionChanges(snapshotOf(current, previous), [ranged(960)])).toEqual([]);
  });

  it("names the lower edge when that is the near one", () => {
    const current = [ranged(40)];
    expect(positionChanges(snapshotOf([ranged(500)]), current)).toEqual([
      { kind: "nearing", position: current[0], edge: "lower" },
    ]);
  });

  it("warns again only after the position has come well clear", () => {
    let snapshot = snapshotOf([ranged(500)]);
    const warnings: string[] = [];
    for (const tick of [950, 850, 950, 750, 950]) {
      for (const change of positionChanges(snapshot, [ranged(tick)])) warnings.push(`${tick}:${change.kind}`);
      snapshot = snapshotOf([ranged(tick)], snapshot);
    }

    // 850 is still within a fifth of the edge, so the next 950 is not a second warning; 750 is clear of it.
    expect(warnings).toEqual(["950:nearing", "950:nearing"]);
  });

  it("reports leaving as leaving, whether it was near first or not", () => {
    expect(positionChanges({ "v3:1": "near" }, [ranged(1_100)])).toEqual([{ kind: "left", position: ranged(1_100) }]);
    expect(positionChanges({ "v3:1": true }, [ranged(1_100)])).toEqual([{ kind: "left", position: ranged(1_100) }]);
  });

  it("reports coming back as coming back, even straight into the near zone, and never as a warning", () => {
    expect(positionChanges({ "v3:1": false }, [ranged(950)])).toEqual([{ kind: "entered", position: ranged(950) }]);
  });

  it("is silent going from near back towards the middle", () => {
    expect(positionChanges({ "v3:1": "near" }, [ranged(500)])).toEqual([]);
  });

  it("reads links stored before the near state existed exactly as before", () => {
    expect(positionChanges({ "v3:1": true }, [ranged(500)])).toEqual([]);
    expect(positionChanges({ "v3:1": null }, [ranged(950)])).toEqual([]);
  });

  it("reports where each edge is by tick, not by a guess at price", () => {
    expect(nearestEdge(ranged(30))).toEqual({ edge: "lower", share: 0.03 });
    expect(nearestEdge(ranged(980))).toEqual({ edge: "upper", share: 0.02 });
    expect(nearestEdge(ranged(null))).toBeNull();
  });
});
