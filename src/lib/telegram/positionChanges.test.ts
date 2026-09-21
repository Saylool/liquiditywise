import { describe, expect, it } from "vitest";

import type { Position } from "../../schemas";
import { positionChanges, positionKey, snapshotOf } from "./positionChanges";

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
