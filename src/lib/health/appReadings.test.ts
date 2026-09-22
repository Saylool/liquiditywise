import { describe, expect, it } from "vitest";

import { fakeStore } from "../telegram/fakeStore";
import { ALERT_HEARTBEAT_KEY, recordAlertRun, takeAppReadings } from "./appReadings";
import { problemsFrom } from "./problems";

const NOW = new Date("2026-09-22T12:00:00.000Z");

describe("what the application can see of itself", () => {
  /*
   * A deployment with no store configured is not a broken one. It is the
   * arrangement someone gets by running this without Telegram at all, and the
   * page already says alerts are not set up here.
   */
  it("reports nothing when there is no store to check", async () => {
    expect(await takeAppReadings({ store: null, now: NOW })).toEqual({});
  });

  it("finds a working store working", async () => {
    const store = fakeStore();

    expect(await takeAppReadings({ store, now: NOW })).toMatchObject({ storeAnswered: true });
  });

  it("finds a store that is not answering", async () => {
    const store = fakeStore();
    store.down = true;

    expect(await takeAppReadings({ store, now: NOW })).toEqual({ storeAnswered: false });
  });

  /*
   * The failure this is built for. A ping only proves a socket; a store that
   * connects and then does not keep what it is given loses the links, and
   * everything above it keeps working — which is why the probe is written and
   * read back rather than pinged.
   */
  it("finds a store that accepts a write and does not keep it", async () => {
    const store = fakeStore();
    const readings = await takeAppReadings({
      store: { ...store, set: async () => true, get: async () => null },
      now: NOW,
    });

    expect(readings).toEqual({ storeAnswered: false });
  });

  it("finds a store that gives back something other than what it was given", async () => {
    const store = fakeStore();
    const readings = await takeAppReadings({
      store: { ...store, set: async () => true, get: async () => "someone else's value" },
      now: NOW,
    });

    expect(readings).toEqual({ storeAnswered: false });
  });

  /*
   * A store that is down cannot say when the alert pass last ran, and its
   * `get` answers `undefined` for that as it does for everything. Reporting a
   * stopped pass on the strength of it would be inventing the second half of
   * an outage.
   */
  it("does not also claim the alert pass has stopped when the store is down", async () => {
    const store = fakeStore();
    store.down = true;

    const readings = await takeAppReadings({ store, now: NOW });

    expect(readings.lastAlertRunMs).toBeUndefined();
    expect(problemsFrom(readings).map((problem) => problem.id)).toEqual(["store-unreachable"]);
  });
});

describe("the mark an alert pass leaves behind", () => {
  it("reads back as the moment the pass finished", async () => {
    const store = fakeStore();
    await recordAlertRun(store, new Date("2026-09-22T11:58:00.000Z"));

    const readings = await takeAppReadings({ store, now: NOW });

    expect(readings.lastAlertRunMs).toBe(Date.parse("2026-09-22T11:58:00.000Z"));
    expect(readings.nowMs).toBe(NOW.getTime());
    expect(problemsFrom(readings)).toEqual([]);
  });

  it("is missing before any pass has finished, which is quiet", async () => {
    const store = fakeStore();

    const readings = await takeAppReadings({ store, now: NOW });

    expect(readings.lastAlertRunMs).toBeNull();
    expect(problemsFrom(readings)).toEqual([]);
  });

  it("shows a pass that has stopped", async () => {
    const store = fakeStore();
    await recordAlertRun(store, new Date("2026-09-22T09:00:00.000Z"));

    const readings = await takeAppReadings({ store, now: NOW });

    expect(problemsFrom(readings).map((problem) => problem.id)).toEqual(["alerts-not-running"]);
  });

  /*
   * Nothing but a pass writes this key, so a value that is not a timestamp
   * means something unaccounted for did. "Never ran" would be a louder claim
   * than the evidence supports, and it happens to be the quiet one — so the
   * distinction is kept deliberately rather than by accident.
   */
  it("says nothing about a mark it cannot read", async () => {
    const store = fakeStore();
    store.data.set(ALERT_HEARTBEAT_KEY, "yesterday, about lunchtime");

    const readings = await takeAppReadings({ store, now: NOW });

    expect(readings.lastAlertRunMs).toBeUndefined();
    expect(problemsFrom(readings)).toEqual([]);
  });

  /*
   * A store can answer one command and not the next — the probe round-trips,
   * the read after it times out. Saying "never ran" there would report a
   * stopped alert pass on the strength of a read that did not happen, which
   * is the distinction this store's three-valued `get` exists to keep.
   */
  it("says nothing when the read for the mark is the one that fails", async () => {
    const store = fakeStore();
    const readings = await takeAppReadings({
      store: {
        ...store,
        get: async (key) => (key === ALERT_HEARTBEAT_KEY ? undefined : store.get(key)),
      },
      now: NOW,
    });

    expect(readings.storeAnswered).toBe(true);
    expect(readings.lastAlertRunMs).toBeUndefined();
    expect(problemsFrom(readings)).toEqual([]);
  });

  /* The probe must not be mistaken for anyone's data: it expires on its own. */
  it("gives the probe a lifetime, so a store that is never checked again forgets it", async () => {
    const ttls: (number | undefined)[] = [];
    const store = fakeStore();

    await takeAppReadings({
      store: { ...store, set: async (key, value, ttlMs) => {
        ttls.push(ttlMs);
        return store.set(key, value, ttlMs);
      } },
      now: NOW,
    });

    expect(ttls).toEqual([expect.any(Number)]);
  });
});
