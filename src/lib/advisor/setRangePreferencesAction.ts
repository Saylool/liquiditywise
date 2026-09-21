"use server";

import { cookies } from "next/headers";

import {
  RANGE_PREFERENCES_COOKIE,
  RANGE_PREFERENCES_MAX_AGE_SECONDS,
  RESET_FIELD,
  serializeRangePreferences,
} from "./rangePreferences";
import {
  APPLICATION_RANGE_DEFAULTS,
  DEPOSIT_PARAMETER,
  HORIZON_PARAMETER,
  MULTIPLIER_PARAMETER,
  readRequestedParameters,
} from "./requestedParameters";

const asText = (value: FormDataEntryValue | null): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * Remembers the band a reader wants every pool opened at, or forgets it.
 *
 * A Server Action driven by a plain `<form>`, like the language, so it works
 * with scripts off. The three values arrive from the network and go through
 * the same reader the query string does, against the application's defaults:
 * what it refuses is not stored, and what it accepts is written in the same
 * form it would be read back in. Nothing arbitrary reaches the cookie.
 *
 * Saving re-renders the current route, which on a pool page reads the pool
 * again — the same cost as switching language, and for the same reason.
 */
export const setRangePreferences = async (formData: FormData): Promise<void> => {
  const store = await cookies();

  if (formData.get(RESET_FIELD) !== null) {
    store.delete(RANGE_PREFERENCES_COOKIE);
    return;
  }

  const read = readRequestedParameters(
    asText(formData.get(HORIZON_PARAMETER)),
    asText(formData.get(MULTIPLIER_PARAMETER)),
    asText(formData.get(DEPOSIT_PARAMETER)),
    APPLICATION_RANGE_DEFAULTS,
  );

  store.set({
    name: RANGE_PREFERENCES_COOKIE,
    value: serializeRangePreferences({ parameters: read.parameters, depositUsd: read.depositUsd }),
    maxAge: RANGE_PREFERENCES_MAX_AGE_SECONDS,
    path: "/",
    // Nothing in the browser reads this, so keep it out of reach of scripts.
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
};
