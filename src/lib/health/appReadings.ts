import type { KeyValueStore } from "../store/keyValueStore";
import type { Readings } from "./problems";

/*
 * The readings the application can take of itself.
 *
 * Two, and both are about the machinery nobody looks at: the store the
 * Telegram links live in, and whether the pass that reads them is still
 * running. Neither shows on any page, which is why they need a monitor at
 * all — a broken one leaves the site working and the alerts silent.
 *
 * The rest of the readings come from outside, because a process cannot
 * report that it has stopped.
 */

/**
 * Where the alert pass records that it finished, as an ISO timestamp.
 *
 * Under the same prefix as everything else this application stores, so
 * `keys liquiditywise:*` still shows the whole of it and `/stop` still leaves
 * nothing of a reader behind — this key is about the server, not a person.
 */
export const ALERT_HEARTBEAT_KEY = "liquiditywise:health:lastalertrun";

/** Written, read back and left to expire; never read for its value. */
const PROBE_KEY = "liquiditywise:health:probe";

/** Long enough to survive the read that follows it, short enough to vanish. */
const PROBE_TTL_MS = 60_000;

/** Called at the end of a pass over the watches, so silence becomes measurable. */
export const recordAlertRun = async (store: KeyValueStore, at: Date): Promise<void> => {
  await store.set(ALERT_HEARTBEAT_KEY, at.toISOString());
};

const parseRun = (raw: string | null | undefined): number | null | undefined => {
  // The store did not answer; that is a separate fault, reported separately.
  if (raw === undefined) return undefined;
  // It answered, and there is nothing there: the pass has never finished.
  if (raw === null) return null;

  const at = Date.parse(raw);

  /*
   * Something unreadable is in the key. It cannot have come from a pass, so
   * nothing is known about when one last ran — and saying "never" here would
   * be a claim this function cannot support.
   */
  return Number.isNaN(at) ? undefined : at;
};

/**
 * A round trip, not a ping.
 *
 * A Redis that accepts a connection and then fails to write is the failure
 * worth catching: the site keeps serving, the links stop being saved, and
 * nothing anywhere says so. So the probe writes a value only this call knows
 * and requires that same value back.
 */
const storeAnswers = async (store: KeyValueStore, at: Date): Promise<boolean> => {
  const written = at.toISOString();

  return (await store.set(PROBE_KEY, written, PROBE_TTL_MS)) && (await store.get(PROBE_KEY)) === written;
};

/**
 * `store` is `null` when this deployment has no store to check — nothing is
 * reported then, because a deployment configured without alerts is not a
 * deployment whose alerts are broken.
 */
export const takeAppReadings = async ({
  store,
  now,
}: {
  readonly store: KeyValueStore | null;
  readonly now: Date;
}): Promise<Readings> => {
  if (store === null) return {};

  const answered = await storeAnswers(store, now);

  /*
   * A store that is not answering cannot be asked when the pass last ran, and
   * the answer it would give — a `get` returning `undefined` — is indistinct
   * from a missing key by design. Reading it anyway would turn one outage
   * into two messages, the second of them a guess.
   */
  if (!answered) return { storeAnswered: false };

  return {
    storeAnswered: true,
    lastAlertRunMs: parseRun(await store.get(ALERT_HEARTBEAT_KEY)),
    nowMs: now.getTime(),
  };
};
