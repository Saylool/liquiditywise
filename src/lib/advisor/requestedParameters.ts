import {
  DepositUsdSchema,
  type PriceBandParameters,
  PriceBandParametersSchema,
} from "../../schemas";
import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";

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

/**
 * The deposits the interface offers.
 *
 * A thousandfold apart end to end, because the figure they scale is not linear
 * in them. A deposit takes `L / (A + L)` of what a pool charges, so on a pool
 * small enough the largest of these dilutes itself visibly while the smallest
 * does not — and seeing that happen is worth more than any one of the amounts.
 */
export const DEPOSIT_CHOICES = [1_000, 10_000, 100_000, 1_000_000] as const;

/** Query parameter names, short enough to read in a URL bar. */
export const HORIZON_PARAMETER = "days";
export const MULTIPLIER_PARAMETER = "sigma";
export const DEPOSIT_PARAMETER = "usd";

/** A decimal, written the way a URL writes one. No exponent, no sign, no comma. */
const DECIMAL = /^\d+(?:\.\d+)?$/;

/**
 * What a field falls back to when the URL does not name it.
 *
 * Two layers rather than one: the application's own defaults, and — above
 * them — what the reader chose in their preferences, which arrives from a
 * cookie. A link that names a horizon still wins over both, because a link is
 * a particular reading of a particular pool and the reader following it
 * should see the reading it names.
 */
export type RangeDefaults = {
  readonly parameters: PriceBandParameters;
  readonly depositUsd: number;
};

/** The application's own defaults, beneath any preference. */
export const APPLICATION_RANGE_DEFAULTS: RangeDefaults = {
  parameters: DEFAULT_PRICE_BAND_PARAMETERS,
  depositUsd: DEFAULT_DEPOSIT_USD,
};

export type RequestedParameters = {
  readonly parameters: PriceBandParameters;
  /**
   * The deposit to work a fee share out for, in US dollars.
   *
   * Beside the band rather than inside it, because it changes nothing about
   * which range is suggested — it only scales one figure at the end. The page
   * prints the amount next to every number derived from it, so a reader always
   * knows which deposit they are looking at.
   */
  readonly depositUsd: number;
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
  accepts: (value: number) => boolean,
): Field => {
  if (raw === undefined) return { value: fallback, fellBack: false };

  const trimmed = raw.trim();
  if (!DECIMAL.test(trimmed)) return { value: fallback, fellBack: true };

  const parsed = Number(trimmed);
  if (!accepts(parsed)) return { value: fallback, fellBack: true };

  return { value: parsed, fellBack: false };
};

/**
 * Reads both band parameters out of what arrived, falling back per field.
 *
 * The fallback is `defaults` — the reader's preferences when they have set
 * any, the application's own otherwise — and it applies field by field: a URL
 * naming only a horizon takes its width and deposit from the preferences, not
 * from the application.
 *
 * A repeated query parameter arrives as an array; only a single value is an
 * answer, and an array is treated as unreadable rather than having one of its
 * values picked.
 */
export const readRequestedParameters = (
  horizon: string | string[] | undefined,
  multiplier: string | string[] | undefined,
  deposit: string | string[] | undefined,
  defaults: RangeDefaults = APPLICATION_RANGE_DEFAULTS,
): RequestedParameters => {
  const single = (value: string | string[] | undefined): string | undefined =>
    value === undefined || typeof value === "string" ? value : "";

  const horizonDays = readField(
    single(horizon),
    defaults.parameters.horizonDays,
    (value) =>
      PriceBandParametersSchema.safeParse({
        ...DEFAULT_PRICE_BAND_PARAMETERS,
        horizonDays: value,
      }).success,
  );

  const standardDeviationMultiplier = readField(
    single(multiplier),
    defaults.parameters.standardDeviationMultiplier,
    (value) =>
      PriceBandParametersSchema.safeParse({
        ...DEFAULT_PRICE_BAND_PARAMETERS,
        standardDeviationMultiplier: value,
      }).success,
  );

  /* Its own schema, because it is its own figure and not part of the band. */
  const depositUsd = readField(single(deposit), defaults.depositUsd, (value) =>
    DepositUsdSchema.safeParse(value).success,
  );

  return {
    parameters: {
      horizonDays: horizonDays.value,
      standardDeviationMultiplier: standardDeviationMultiplier.value,
    },
    depositUsd: depositUsd.value,
    fellBack: horizonDays.fellBack || standardDeviationMultiplier.fellBack || depositUsd.fellBack,
  };
};

/**
 * The link to one pool's analysis, carrying a chosen band.
 *
 * Used by every link that leaves one analysis for another, so that a reader who
 * set a ninety-day horizon does not land on the next pool at thirty. Comparing
 * two pools under two different bands is worse than not comparing them: the
 * figures look comparable and are not.
 *
 * Links arriving from a search carry no band, because none was chosen there, and
 * the page falls back to the defaults it documents.
 */
export const poolAnalysisHref = (
  poolAddress: string,
  parameters: PriceBandParameters,
  depositUsd?: number,
): string => {
  const query = new URLSearchParams({
    address: poolAddress,
    [HORIZON_PARAMETER]: String(parameters.horizonDays),
    [MULTIPLIER_PARAMETER]: String(parameters.standardDeviationMultiplier),
  });
  /*
   * Optional, unlike the band, because most links into an analysis come from
   * somewhere no deposit was ever chosen — a search, a list of holdings — and
   * appending the default there would put a number in the URL that nobody asked
   * for. The links that do pass one are the two that leave an analysis for
   * another pool from inside it, where a size *has* been chosen and arriving
   * back at a thousand dollars would silently change what is being compared.
   */
  if (depositUsd !== undefined) query.set(DEPOSIT_PARAMETER, String(depositUsd));

  return `/pool?${query.toString()}`;
};

/**
 * Every v3 fee tier of a pool's pair, read side by side under the band and
 * deposit the reader is already looking at — a comparison under two different
 * settings would look like one and not be.
 */
export const poolComparisonHref = (
  poolAddress: string,
  parameters: PriceBandParameters,
  depositUsd: number,
): string =>
  `/compare?${new URLSearchParams({
    address: poolAddress,
    [HORIZON_PARAMETER]: String(parameters.horizonDays),
    [MULTIPLIER_PARAMETER]: String(parameters.standardDeviationMultiplier),
    [DEPOSIT_PARAMETER]: String(depositUsd),
  }).toString()}`;

/**
 * The same link for a v4 pool, which has its own page and is named by a
 * 32-byte id under a different parameter. The band travels with it for the
 * same reason as above: two pools compared under two different bands look
 * comparable and are not.
 */
export const v4PoolAnalysisHref = (
  poolId: string,
  parameters: PriceBandParameters,
  depositUsd?: number,
): string => {
  const query = new URLSearchParams({
    id: poolId,
    [HORIZON_PARAMETER]: String(parameters.horizonDays),
    [MULTIPLIER_PARAMETER]: String(parameters.standardDeviationMultiplier),
  });
  if (depositUsd !== undefined) query.set(DEPOSIT_PARAMETER, String(depositUsd));

  return `/v4?${query.toString()}`;
};
