import {
  APPLICATION_RANGE_DEFAULTS,
  type RangeDefaults,
  readRequestedParameters,
} from "./requestedParameters";

/*
 * The band a reader wants every pool opened at, remembered between visits.
 *
 * Before this, every analysis opened at the application's defaults and a
 * reader who always wanted a week ahead and a wide band set both on every
 * pool. Now they set them once, in the preferences beside language and theme,
 * and each pool opens there — unless a link names its own, because a link is a
 * particular reading and the reader following it should see that reading.
 *
 * A cookie rather than a session or an account, for the same reason the
 * language is: there is no account here, the preference is the reader's own
 * browser's business, and the server needs it on the first paint to render the
 * right band rather than correct it afterwards.
 *
 * Pure. Reading the cookie and writing it are next door, with the framework.
 */

export const RANGE_PREFERENCES_COOKIE = "range";

/** A year, like the language: a preference does not go stale. */
export const RANGE_PREFERENCES_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The one form field that is not a number: a request to forget the preference.
 *
 * Here rather than beside the action that reads it, because a `"use server"`
 * module may export nothing but async functions — a constant there is a build
 * error, and the form that sends it needs the same name the action checks.
 */
export const RESET_FIELD = "reset";

/**
 * Three decimals with a colon between, in the order the form reads them.
 *
 * Not JSON: a cookie is a poor place for structure, and three numbers do not
 * need any. Written the way a URL writes a number, so the same reader that
 * checks the query string checks this — one set of rules for what a horizon
 * may be, wherever it arrives from.
 */
const SEPARATOR = ":";

export const serializeRangePreferences = (defaults: RangeDefaults): string =>
  [
    defaults.parameters.horizonDays,
    defaults.parameters.standardDeviationMultiplier,
    defaults.depositUsd,
  ].join(SEPARATOR);

/**
 * What a stored preference amounts to, checked field by field.
 *
 * `null` when nothing was stored. A stored value the schema refuses — this
 * cookie is written only by this application, so that means it was edited —
 * is not `null`: the fields that still parse are kept and the rest fall to the
 * application's defaults, exactly as a half-usable URL is treated. The page
 * shows the band it actually used either way.
 */
export const parseRangePreferences = (stored: string | undefined): RangeDefaults | null => {
  if (stored === undefined) return null;

  const [horizon, multiplier, deposit] = stored.split(SEPARATOR);
  const read = readRequestedParameters(horizon, multiplier, deposit, APPLICATION_RANGE_DEFAULTS);

  return { parameters: read.parameters, depositUsd: read.depositUsd };
};
