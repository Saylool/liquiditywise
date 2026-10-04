import { z } from "zod";

import { ETHEREUM } from "../chains/chains";
import { getEmbedCopy } from "../i18n/embedCopy";
import { EMBED_CARD_HEADERS } from "../security/responseHeaders";
import type { EmbedRequest } from "./embedRequest";
import { embedCardUrl, embedDataUrl, embedSnippet } from "./embedLinks";
import { FIGURES_CACHE, NOT_A_POOL_CACHE, UNREADABLE_CACHE } from "./embedResponses";
import { embeddedPoolUrl, MEASURED_DAYS, PoolEmbedSchema, type PoolEmbed } from "./poolEmbed";

/*
 * What the developers page states about the card and its JSON, taken from the
 * code that serves them rather than written beside it.
 *
 * The page documents an interface somebody else's code will be written
 * against, so a sentence that drifted from the code would not just be wrong,
 * it would break their code. So each fact here is either built from the code
 * — the field list from the schema the answer is checked against on its way
 * out, the snippet and the addresses from the functions the pool page offers
 * them with, the cache lifetimes and the card's policy from the constants the
 * routes send — or written out and held to the code by embedDocs.test.ts: the
 * parameters to what the request parser actually reads, the example answer to
 * what the builder makes of a known month, each status and its body to what
 * the routes and the proxy answer.
 *
 * Code samples are English and identical in every language: a field name or
 * a status is the same word whoever reads it. Only the prose around them is
 * translated (i18n/developersCopy.ts).
 *
 * Pure and static: nothing here reads the network, the clock or a pool.
 */

/** Every parameter the card and its JSON read, in the order the page lists them. */
export const EMBED_PARAMETERS = ["address", "id", "chain", "lang"] as const;

export type EmbedParameter = (typeof EMBED_PARAMETERS)[number];

/** "price.current" for `{ price: { current } }`: every leaf of an answer, by the path a script reads it at. */
type LeafPaths<T, Prefix extends string = ""> = {
  [Key in keyof T & string]: T[Key] extends object ? LeafPaths<T[Key], `${Prefix}${Key}.`> : `${Prefix}${Key}`;
}[keyof T & string];

/** A field of a `200` answer. The compiler holds every language's descriptions to exactly these. */
export type EmbedFieldPath = LeafPaths<PoolEmbed>;

export type EmbedField = {
  readonly path: EmbedFieldPath;
  /** As JSON Schema puts it, shortened: `number > 0`, `integer ≥ 0 | null`, `"v3" | "v4"`. */
  readonly type: string;
};

/** The slice of JSON Schema the schema below turns into. */
type JsonSchema = {
  readonly type?: string;
  readonly enum?: readonly unknown[];
  readonly anyOf?: readonly JsonSchema[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly format?: string;
  readonly minimum?: number;
  readonly exclusiveMinimum?: number;
};

const typeOf = (schema: JsonSchema): string => {
  if (schema.anyOf !== undefined) return schema.anyOf.map(typeOf).join(" | ");
  if (schema.enum !== undefined) return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.format === "date-time") return "string (ISO 8601)";
  const bound = schema.exclusiveMinimum === 0 ? " > 0" : schema.minimum === 0 ? " ≥ 0" : "";
  return `${schema.type ?? "unknown"}${bound}`;
};

const leaves = (schema: JsonSchema, prefix = ""): EmbedField[] =>
  Object.entries(schema.properties ?? {}).flatMap(([name, property]) =>
    property.properties !== undefined
      ? leaves(property, `${prefix}${name}.`)
      : [{ path: `${prefix}${name}` as EmbedFieldPath, type: typeOf(property) }],
  );

/**
 * Every field of a `200` answer, in the order it is sent, generated from the
 * schema the answer is checked against before it leaves (poolEmbed.ts). A
 * field added there appears here without anyone writing it down — and the
 * build fails until every language says what it is.
 */
export const EMBED_FIELDS: readonly EmbedField[] = leaves(
  z.toJSONSchema(PoolEmbedSchema, { io: "output", unrepresentable: "any" }) as JsonSchema,
);

/**
 * The pool every example names: USDC / WETH at 0.3% on Ethereum mainnet, a
 * pool the site's own tests name too. A real address, so every example can be
 * pasted and run as it stands.
 */
export const EXAMPLE_REQUEST: EmbedRequest = {
  protocol: "v3",
  chain: ETHEREUM,
  poolId: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
};

export const EXAMPLE_PAIR = "USDC / WETH";

/** The frame, exactly as that pool's page offers it to an English reader. */
export const EXAMPLE_SNIPPET = embedSnippet(EXAMPLE_REQUEST, EXAMPLE_PAIR, false, "en");

export const EXAMPLE_CARD_URL = embedCardUrl(EXAMPLE_REQUEST, "en");
export const EXAMPLE_DATA_URL = embedDataUrl(EXAMPLE_REQUEST);

export const EXAMPLE_CURL = `curl -s "${EXAMPLE_DATA_URL}"`;

/**
 * Every field it reads is one the answer has (a test reads the `body.…`
 * paths back out of it), and every status it tests is one the routes send.
 */
export const EXAMPLE_FETCH = `const response = await fetch(
  "${EXAMPLE_DATA_URL}",
);
const body = await response.json();

if (response.ok) {
  // The range, in body.price.quote per one body.price.base
  console.log(body.range.lower, body.range.upper, body.price.quote, body.price.base);
  console.log(body.disclaimer);
} else if (response.status === 429) {
  console.log(\`Asked too often: wait \${body.retryAfterSeconds} seconds\`);
} else {
  console.log(body.error); // "not-a-pool" or "unreadable"
}`;

/**
 * An answer, as the builder writes it for the example pool over the sample
 * month in testing/poolAnalysisFixture.ts — 3,000 USDC per WETH, moving 1%
 * a day. Written out rather than worked out on every render, because the page
 * has no business running the analysis; embedDocs.test.ts runs it and holds
 * this to what comes out, figure for figure.
 */
export const EXAMPLE_RESPONSE: PoolEmbed = {
  protocol: "v3",
  chain: { id: 1, slug: "ethereum", name: "Ethereum" },
  pool: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
  pair: { token0: "USDC", token1: "WETH" },
  lpFeePpm: 3000,
  price: { base: "WETH", quote: "USDC", current: 3000 },
  range: {
    lower: 2824.2704157479307,
    upper: 3184.336896959513,
    currentInRange: true,
    lowerTruncated: false,
    upperTruncated: false,
  },
  parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
  hookMayAlterSwaps: false,
  analysedAt: "2026-08-21T09:15:00.000Z",
  poolUrl: "https://liquiditywise.com/pool?address=0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8&days=30&sigma=1",
  disclaimer:
    "For information only, not financial advice. The range is worked out from how far this pool's price moved over the last 30 days: it is not a forecast and not a recommendation.",
};

/** What every answer of the JSON is: the figures, or one of three failures. */
export const EMBED_STATUS_KINDS = ["figures", "not-a-pool", "unreadable", "rate-limited"] as const;

export type EmbedStatusKind = (typeof EMBED_STATUS_KINDS)[number];

export type EmbedStatus = {
  readonly kind: EmbedStatusKind;
  readonly status: number;
  /** The `error` a failure's JSON carries; `null` for the figures. */
  readonly error: Exclude<EmbedStatusKind, "figures"> | null;
  readonly cacheControl: string;
  /** Any other header that status is sent with. */
  readonly headers: readonly (readonly [string, string])[];
  /** The JSON's body for the example pool, or `null` where it is the figures above. */
  readonly body: Readonly<Record<string, unknown>> | null;
};

const disclaimer = getEmbedCopy("en").disclaimer(String(MEASURED_DAYS));

/** A wait, for the refusal's example: a real one says how long is left of the client's window. */
const EXAMPLE_WAIT_SECONDS = 42;

/**
 * Each status, with how long it may be kept and what the JSON says. Held to
 * embedResponses.ts and to the proxy's refusal by embedDocs.test.ts.
 */
export const EMBED_STATUSES: readonly EmbedStatus[] = [
  { kind: "figures", status: 200, error: null, cacheControl: FIGURES_CACHE, headers: [], body: null },
  {
    kind: "not-a-pool",
    status: 400,
    error: "not-a-pool",
    cacheControl: NOT_A_POOL_CACHE,
    headers: [],
    body: { error: "not-a-pool", disclaimer },
  },
  {
    kind: "unreadable",
    status: 503,
    error: "unreadable",
    cacheControl: UNREADABLE_CACHE,
    headers: [],
    body: { error: "unreadable", poolUrl: embeddedPoolUrl(EXAMPLE_REQUEST), disclaimer },
  },
  {
    kind: "rate-limited",
    status: 429,
    error: "rate-limited",
    cacheControl: "no-store",
    headers: [["Retry-After", String(EXAMPLE_WAIT_SECONDS)]],
    body: { error: "rate-limited", retryAfterSeconds: EXAMPLE_WAIT_SECONDS },
  },
];

/** The headers a card with figures is sent with, beside the ones every page carries. */
export const CARD_HEADERS: readonly (readonly [string, string])[] = [
  ["Content-Type", "text/html; charset=utf-8"],
  ["Cache-Control", FIGURES_CACHE],
  ...EMBED_CARD_HEADERS.map(({ key, value }) => [key, value] as const),
];

/** And the JSON's. */
export const DATA_HEADERS: readonly (readonly [string, string])[] = [
  ["Content-Type", "application/json; charset=utf-8"],
  ["Cache-Control", FIGURES_CACHE],
  ["Access-Control-Allow-Origin", "*"],
];

/** Headers as they are written on the wire, one to a line. */
export const headerLines = (headers: readonly (readonly [string, string])[]): string =>
  headers.map(([key, value]) => `${key}: ${value}`).join("\n");
