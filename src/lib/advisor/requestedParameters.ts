import { type PriceBandParameters, PriceBandParametersSchema } from "../../schemas";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";

/*
 * The band parameters a visitor asked for, read from the query string.
 *
 * They live in the URL rather than in a session or a request body for the same
 * reason the pool address does: an analysis is a place. It can be linked,
 * reloaded, gone back to and compared with another tab, and the form that sets
 * it can be plain HTML with no client JavaScript.
 *
 * Nothing here narrows what the pipeline accepts. The schema is the authority on
 * what a horizon and a multiplier may be, and every field is checked against it
 * — so a value typed into the URL that the calculator would accept is accepted,
 * whether or not the interface offers a button for it.
 */

/**
 * The horizons the interface offers.
 *
 * Volatility is always measured over the last 30 completed days, whatever is
 * chosen here: the horizon says how far that measured movement is laid forward,
 * not how much history went into measuring it. A year-ahead band from a month of
 * observations is a much larger extrapolation than it looks, which is why the
 * longest button stops at a quarter — the schema still accepts up to a year for
 * anyone who types one.
 */
export const HORIZON_CHOICES = [7, 30, 90] as const;

/**
 * The multipliers the interface offers.
 *
 * Not confidence levels. Turning "two standard deviations" into "95% of the
 * time" needs a distributional assumption this project has not established, and
 * the page says so under the band.
 */
export const MULTIPLIER_CHOICES = [1, 1.5, 2, 3] as const;

/** Query parameter names, short enough to read in a URL bar. */
export const HORIZON_PARAMETER = "days";
export const MULTIPLIER_PARAMETER = "sigma";

/** A decimal, written the way a URL writes one. No exponent, no sign, no comma. */
const DECIMAL = /^\d+(?:\.\d+)?$/;

export type RequestedParameters = {
  readonly parameters: PriceBandParameters;
  /**
   * True when something was asked for and could not be used.
   *
   * The analysis still runs, on the default for whichever field was unreadable,
   * and the page says so. Refusing outright would throw away a whole analysis
   * over a mistyped URL; using the default silently would show a band nobody
   * asked for — and the page prints the horizon and the multiplier it actually
   * used, so a reader who is told this can see exactly what happened.
   */
  readonly fellBack: boolean;
};

type Field = { readonly value: number; readonly fellBack: boolean };

/**
 * Reads one field, checking it against the schema on its own.
 *
 * Each field is validated by varying only itself away from the defaults, so a
 * usable horizon still applies when the multiplier beside it is nonsense.
 */
const readField = (
  raw: string | undefined,
  fallback: number,
  candidate: (value: number) => PriceBandParameters,
): Field => {
  if (raw === undefined) return { value: fallback, fellBack: false };

  const trimmed = raw.trim();
  if (!DECIMAL.test(trimmed)) return { value: fallback, fellBack: true };

  const parsed = Number(trimmed);
  if (!PriceBandParametersSchema.safeParse(candidate(parsed)).success) {
    return { value: fallback, fellBack: true };
  }

  return { value: parsed, fellBack: false };
};

/**
 * Reads both band parameters out of what arrived, falling back per field.
 *
 * A repeated query parameter arrives as an array; only a single value is an
 * answer, and an array is treated as unreadable rather than having one of its
 * values picked.
 */
export const readRequestedParameters = (
  horizon: string | string[] | undefined,
  multiplier: string | string[] | undefined,
): RequestedParameters => {
  const single = (value: string | string[] | undefined): string | undefined =>
    value === undefined || typeof value === "string" ? value : "";

  const horizonDays = readField(
    single(horizon),
    DEFAULT_PRICE_BAND_PARAMETERS.horizonDays,
    (value) => ({ ...DEFAULT_PRICE_BAND_PARAMETERS, horizonDays: value }),
  );

  const standardDeviationMultiplier = readField(
    single(multiplier),
    DEFAULT_PRICE_BAND_PARAMETERS.standardDeviationMultiplier,
    (value) => ({ ...DEFAULT_PRICE_BAND_PARAMETERS, standardDeviationMultiplier: value }),
  );

  return {
    parameters: {
      horizonDays: horizonDays.value,
      standardDeviationMultiplier: standardDeviationMultiplier.value,
    },
    fellBack: horizonDays.fellBack || standardDeviationMultiplier.fellBack,
  };
};
