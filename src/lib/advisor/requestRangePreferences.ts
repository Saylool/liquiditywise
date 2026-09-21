import "server-only";

import { cookies } from "next/headers";

import { parseRangePreferences, RANGE_PREFERENCES_COOKIE } from "./rangePreferences";
import { APPLICATION_RANGE_DEFAULTS, type RangeDefaults } from "./requestedParameters";

export type RangePreferenceState = {
  /** What pools open at for this reader: their preference, or the application's defaults. */
  readonly current: RangeDefaults;
  /** Whether that is a preference they set, which decides whether there is one to forget. */
  readonly hasPreference: boolean;
};

/**
 * The band the request's reader wants pools opened at, and whether they said.
 *
 * The application's own defaults when they have never said — so every caller
 * gets something to fall back to, and none has to know whether a preference
 * exists.
 */
export const getRangePreferenceState = async (): Promise<RangePreferenceState> => {
  const store = await cookies();
  const stored = parseRangePreferences(store.get(RANGE_PREFERENCES_COOKIE)?.value);

  return stored === null
    ? { current: APPLICATION_RANGE_DEFAULTS, hasPreference: false }
    : { current: stored, hasPreference: true };
};

export const getRangePreferences = async (): Promise<RangeDefaults> =>
  (await getRangePreferenceState()).current;
