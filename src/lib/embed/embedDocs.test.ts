import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { proxy } from "../../proxy";
import { CHAINS, chainBySlug, ETHEREUM } from "../chains/chains";
import { getDevelopersCopy } from "../i18n/developersCopy";
import { LOCALES } from "../i18n/locales";
import { POOL_ANALYSIS_REQUEST_LIMIT } from "../ratelimit/poolAnalysisRateLimiter";
import { EMBED_CARD_PATH } from "../security/responseHeaders";
import { fixtureAnalysis } from "../testing/poolAnalysisFixture";
import { developerFigures } from "../../components/DevelopersPage";
import {
  CARD_HEADERS,
  DATA_HEADERS,
  EMBED_FIELDS,
  EMBED_PARAMETERS,
  EMBED_STATUSES,
  EXAMPLE_CARD_URL,
  EXAMPLE_CURL,
  EXAMPLE_DATA_URL,
  EXAMPLE_FETCH,
  EXAMPLE_REQUEST,
  EXAMPLE_RESPONSE,
  EXAMPLE_SNIPPET,
  type EmbedParameter,
  type EmbedStatus,
} from "./embedDocs";
import { readEmbedLocale, readEmbedRequest } from "./embedRequest";
import { embedCardResponse, embedDataResponse, type EmbedAnswer } from "./embedResponses";
import { embeddedPoolUrl, PoolEmbedSchema, poolEmbedData, poolEmbedFigures } from "./poolEmbed";

/*
 * The developers page, held to the code it documents.
 *
 * Somebody else's code is written against that page, so every way it could
 * drift is a failure here rather than a bug report later: a field added to the
 * answer that the page does not describe, a parameter the page names that the
 * address is not read with (or one it is read with that the page leaves out),
 * an example that is no longer what the code answers, a status, a header or a
 * cache lifetime that is no longer the one sent.
 *
 * Each fact is checked against the code itself — the schema walked on its
 * own, the parser watched as it reads, the routes and the proxy asked — never
 * against a second copy of the same list.
 */

const POOL = EXAMPLE_REQUEST.poolId;
const V4_ID = `0x${"cd".repeat(32)}`;
const BROWSER = "Mozilla/5.0 (Macintosh) Safari/605.1.15";

const query = (entries: Record<string, string | readonly string[]>): URLSearchParams => {
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(entries)) {
    for (const one of typeof value === "string" ? [value] : value) parameters.append(name, one);
  }
  return parameters;
};

/** Every leaf of a value, by the path a script reads it at, in the order it is written. */
const leafPaths = (value: unknown, prefix = ""): string[] =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, item]) => leafPaths(item, `${prefix}${key}.`))
    : [prefix.slice(0, -1)];

/** The same, from the zod schema's own shape, walked without JSON Schema in between. */
const schemaPaths = (schema: z.ZodType, prefix = ""): string[] => {
  const inner = schema instanceof z.ZodNullable ? (schema.unwrap() as z.ZodType) : schema;
  return inner instanceof z.ZodObject
    ? Object.entries(inner.shape as Record<string, z.ZodType>).flatMap(([key, item]) => schemaPaths(item, `${prefix}${key}.`))
    : [prefix.slice(0, -1)];
};

const at = (value: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | null)?.[key], value);

describe("the fields the developers page documents", () => {
  const documented = EMBED_FIELDS.map(({ path }) => path);

  it("are every field the answer's schema has, and no other, in the order it is sent", () => {
    expect(documented).toEqual(schemaPaths(PoolEmbedSchema));
    expect(documented).toEqual(leafPaths(EXAMPLE_RESPONSE));
    expect(documented.length).toBeGreaterThan(15);
  });

  it("each have the type the example answer actually carries", () => {
    for (const { path, type } of EMBED_FIELDS) {
      const value = at(EXAMPLE_RESPONSE, path);
      const kinds = type.split(" | ");
      const fits = kinds.some((kind) => {
        if (kind === "null") return value === null;
        if (kind.startsWith('"')) return JSON.stringify(value) === kind;
        if (kind.startsWith("integer")) return Number.isInteger(value);
        if (kind.startsWith("number")) return typeof value === "number";
        if (kind.startsWith("string")) return typeof value === "string";
        if (kind === "boolean") return typeof value === "boolean";
        return false;
      });
      expect(fits, `${path}: ${type} for ${JSON.stringify(value)}`).toBe(true);
    }
  });

  it("say what the schema says of the ones it constrains", () => {
    const type = (path: string) => EMBED_FIELDS.find((field) => field.path === path)?.type;

    expect(type("protocol")).toBe('"v3" | "v4"');
    expect(type("lpFeePpm")).toBe("integer ≥ 0 | null");
    expect(type("price.current")).toBe("number > 0");
    expect(type("analysedAt")).toBe("string (ISO 8601)");
  });

  it("are each described in every language, and nothing else is", () => {
    for (const locale of LOCALES) {
      const described = Object.keys(getDevelopersCopy(locale).fields(developerFigures(locale)));
      expect(described.sort(), locale).toEqual([...documented].sort());
    }
  });
});

describe("the example answer on the developers page", () => {
  const figures = poolEmbedFigures(fixtureAnalysis(), EXAMPLE_REQUEST);

  it("is what the builder makes of the sample month, figure for figure", () => {
    expect(EXAMPLE_RESPONSE).toEqual(poolEmbedData(figures, "en"));
    expect(PoolEmbedSchema.parse(EXAMPLE_RESPONSE)).toEqual(EXAMPLE_RESPONSE);
  });

  it("is what the JSON route sends for it", async () => {
    const response = embedDataResponse({ kind: "pool", figures }, "en");

    expect(await response.json()).toEqual(EXAMPLE_RESPONSE);
  });

  it("names the pool every other example names", () => {
    expect(EXAMPLE_RESPONSE.pool).toBe(EXAMPLE_REQUEST.poolId);
    expect(EXAMPLE_RESPONSE.poolUrl).toBe(embeddedPoolUrl(EXAMPLE_REQUEST));
  });
});

/*
 * Watches what the parser asks of the address. Anything that reads it whole
 * — an iteration, a `toString` — would see parameters this cannot count, so
 * it is refused outright and the test fails rather than passing blind.
 */
class WatchedParameters extends URLSearchParams {
  readonly asked = new Set<string>();
  override get(name: string) {
    this.asked.add(name);
    return super.get(name);
  }
  override getAll(name: string) {
    this.asked.add(name);
    return super.getAll(name);
  }
  override has(name: string, value?: string) {
    this.asked.add(name);
    return super.has(name, value);
  }
  override entries(): URLSearchParamsIterator<[string, string]> {
    throw new Error("the parser read the whole address");
  }
  override keys(): URLSearchParamsIterator<string> {
    throw new Error("the parser read the whole address");
  }
  override values(): URLSearchParamsIterator<string> {
    throw new Error("the parser read the whole address");
  }
  override forEach(): void {
    throw new Error("the parser read the whole address");
  }
  override toString(): string {
    throw new Error("the parser read the whole address");
  }
}

describe("the parameters the developers page documents", () => {
  it("are exactly the ones the card's and the JSON's address is read with", () => {
    const asked = new Set<string>();
    for (const entries of [{}, { address: POOL }, { id: V4_ID, chain: "base" }, { lang: "tr" }]) {
      const parameters = new WatchedParameters(query(entries));
      readEmbedRequest(parameters);
      readEmbedLocale(parameters);
      for (const name of parameters.asked) asked.add(name);
    }

    expect([...asked].sort()).toEqual([...EMBED_PARAMETERS].sort());
  });

  /* A name the parser reads is not enough: each has to change what it reads. */
  it("each change what is read, given a value the page says it accepts", () => {
    const accepted: Record<EmbedParameter, string> = { address: POOL, id: V4_ID, chain: "base", lang: "tr" };
    const read = (parameters: URLSearchParams) => ({ request: readEmbedRequest(parameters), locale: readEmbedLocale(parameters) });

    for (const name of EMBED_PARAMETERS) {
      /* A pool's own name changes what is read by itself; the others, beside a pool. */
      const beside: Record<string, string> = name === "address" || name === "id" ? {} : { address: POOL };

      expect(read(query({ ...beside, [name]: accepted[name] })), name).not.toEqual(read(query(beside)));
    }
  });

  it("are each documented in every language, and nothing else is", () => {
    for (const locale of LOCALES) {
      expect(Object.keys(getDevelopersCopy(locale).parameters(developerFigures(locale))), locale).toEqual([...EMBED_PARAMETERS]);
    }
  });

  /* What the page says each one accepts, and what it says happens otherwise. */
  it("behave as the page says they do", () => {
    const upper = POOL.toUpperCase().replace("0X", "0x");

    expect(readEmbedRequest(query({ address: upper }))).toEqual({ protocol: "v3", chain: ETHEREUM, poolId: POOL });
    expect(readEmbedRequest(query({ id: V4_ID.toUpperCase().replace("0X", "0x") }))?.poolId).toBe(V4_ID);
    expect(readEmbedRequest(query({ address: POOL, chain: "ethereum" }))?.chain).toBe(ETHEREUM);

    for (const refused of [
      {},
      { address: "nope" },
      { id: POOL },
      { address: POOL, id: V4_ID },
      { address: [POOL, POOL] },
      { address: POOL, chain: ["base", "base"] },
      { address: POOL, chain: "solana" },
      { address: POOL, chain: "unichain" },
    ]) {
      expect(readEmbedRequest(query(refused)), JSON.stringify(refused)).toBeNull();
    }

    expect(readEmbedLocale(query({ lang: "zh-Hant" }))).toBe("zh-Hant");
    expect(readEmbedLocale(query({}))).toBe("en");
    expect(readEmbedLocale(query({ lang: "xx" }))).toBe("en");
    expect(readEmbedLocale(query({ lang: ["tr", "tr"] }))).toBe("en");
  });

  it("list every network with what is read on it", () => {
    for (const chain of CHAINS) {
      const slug = chain.slug;
      expect(readEmbedRequest(query({ address: POOL, chain: slug })) !== null, `${slug} v3`).toBe(chain.v3);
      expect(readEmbedRequest(query({ id: V4_ID, chain: slug })) !== null, `${slug} v4`).toBe(chain.v4);
    }
    expect(developerFigures("en").v4OnlyChains).toBe("Unichain");
  });
});

const answerOf = (status: EmbedStatus): EmbedAnswer =>
  status.kind === "figures"
    ? { kind: "pool", figures: poolEmbedFigures(fixtureAnalysis(), EXAMPLE_REQUEST) }
    : status.kind === "unreadable"
      ? { kind: "unreadable", poolUrl: embeddedPoolUrl(EXAMPLE_REQUEST) }
      : { kind: "not-a-pool" };

const asking = (path: string, client: string) =>
  new NextRequest(`http://localhost${path}`, { headers: { "x-forwarded-for": client, "user-agent": BROWSER } });

/** Spends a client's whole allowance on a path, and returns the refusal that follows. */
const refusedAt = async (path: string, client: string): Promise<Response> => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  for (let index = 0; index < POOL_ANALYSIS_REQUEST_LIMIT; index += 1) await proxy(asking(path, client));
  return proxy(asking(path, client));
};

describe("the statuses the developers page documents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("are what the JSON answers, with the body and the lifetime it says", async () => {
    for (const status of EMBED_STATUSES.filter(({ kind }) => kind !== "rate-limited")) {
      const response = embedDataResponse(answerOf(status), "en");
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status, status.kind).toBe(status.status);
      expect(response.headers.get("cache-control"), status.kind).toBe(status.cacheControl);
      if (status.body === null) expect(body, status.kind).toEqual(EXAMPLE_RESPONSE);
      else expect(body, status.kind).toEqual(status.body);
      expect(body.error ?? null, status.kind).toBe(status.error);
    }
  });

  /*
   * The prose states each lifetime as a number of seconds, from the code's
   * constants; the routes send it in a header. Read back from the header, so a
   * lifetime changed in one place and not the other is a failure here.
   */
  it("are kept as long as the page says, by the header actually sent", () => {
    const figures = developerFigures("en");
    const stated: Partial<Record<EmbedStatus["kind"], string>> = {
      figures: figures.keptSeconds,
      unreadable: figures.unreadableSeconds,
      "not-a-pool": figures.notAPoolSeconds,
    };

    for (const status of EMBED_STATUSES.filter(({ kind }) => kind !== "rate-limited")) {
      const header = embedDataResponse(answerOf(status), "en").headers.get("cache-control") ?? "";
      const seconds = Number(stated[status.kind]?.replace(/,/g, ""));
      expect(header, status.kind).toBe(`public, max-age=${seconds}, s-maxage=${seconds}`);
    }
  });

  it("are what the card answers too", () => {
    for (const status of EMBED_STATUSES.filter(({ kind }) => kind !== "rate-limited")) {
      const response = embedCardResponse(answerOf(status), "en");

      expect(response.status, status.kind).toBe(status.status);
      expect(response.headers.get("cache-control"), status.kind).toBe(status.cacheControl);
    }
  });

  it("include the refusal exactly as the proxy sends it, past the limit the page states", async () => {
    const documented = EMBED_STATUSES.find(({ kind }) => kind === "rate-limited")!;
    const refused = await refusedAt(`/api/embed/pool?address=${POOL}`, "198.51.100.181");
    const body = (await refused.json()) as Record<string, unknown>;

    expect(refused.status).toBe(documented.status);
    expect(refused.headers.get("cache-control")).toBe(documented.cacheControl);
    expect(refused.headers.get("access-control-allow-origin")).toBe("*");
    for (const [name] of documented.headers) expect(Number(refused.headers.get(name)), name).toBeGreaterThan(0);
    expect(Object.keys(body).sort()).toEqual(Object.keys(documented.body ?? {}).sort());
    expect(body.error).toBe(documented.error);
    expect(body.retryAfterSeconds).toBe(Number(refused.headers.get("retry-after")));
    /* Refused right after the allowance the page states, and told to wait out the window it states. */
    const window = Number(developerFigures("en").windowSeconds);
    expect(developerFigures("en").limit).toBe(String(POOL_ANALYSIS_REQUEST_LIMIT));
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(window);
    expect(body.retryAfterSeconds).toBeGreaterThan(window - 5);
  });

  it("refuse the card the same way, and count nothing for an address that names no pool", async () => {
    const card = await refusedAt(`${EMBED_CARD_PATH}?address=${POOL}`, "198.51.100.182");
    expect(card.status).toBe(429);
    expect(card.headers.get("cache-control")).toBe("no-store");

    for (let index = 0; index < POOL_ANALYSIS_REQUEST_LIMIT + 2; index += 1) {
      expect((await proxy(asking("/api/embed/pool?address=nope", "198.51.100.183"))).status).toBe(200);
    }
  });
});

describe("the headers the developers page documents", () => {
  const figures = poolEmbedFigures(fixtureAnalysis(), EXAMPLE_REQUEST);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("are the JSON's", () => {
    const response = embedDataResponse({ kind: "pool", figures }, "en");
    for (const [name, value] of DATA_HEADERS) expect(response.headers.get(name), name).toBe(value);
  });

  it("are the card's, the route's and the proxy's together", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const route = embedCardResponse({ kind: "pool", figures }, "en");
    const proxied = await proxy(asking(`${EMBED_CARD_PATH}?address=${POOL}`, "198.51.100.184"));

    for (const [name, value] of CARD_HEADERS) {
      expect(route.headers.get(name) ?? proxied.headers.get(name), name).toBe(value);
    }
  });
});

describe("the examples on the developers page", () => {
  const unescape = (html: string) => html.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const parametersOf = (url: string) => new URL(url).searchParams;

  it("name the example pool at the addresses the code reads", () => {
    const src = unescape(/src="([^"]+)"/.exec(EXAMPLE_SNIPPET)?.[1] ?? "");
    const curled = /"(https:[^"]+)"/.exec(EXAMPLE_CURL)?.[1] ?? "";
    const fetched = /fetch\(\s*"(https:[^"]+)"/.exec(EXAMPLE_FETCH)?.[1] ?? "";

    expect(src).toBe(EXAMPLE_CARD_URL);
    expect(curled).toBe(EXAMPLE_DATA_URL);
    expect(fetched).toBe(EXAMPLE_DATA_URL);
    for (const url of [src, curled, fetched]) expect(readEmbedRequest(parametersOf(url)), url).toEqual(EXAMPLE_REQUEST);
    expect(new URL(src).pathname).toBe(EMBED_CARD_PATH);
    expect(new URL(curled).pathname).toBe("/api/embed/pool");
  });

  it("offer the frame at the size the page states", () => {
    const figures = developerFigures("en");

    expect(EXAMPLE_SNIPPET).toContain(`width="${figures.frameWidth}"`);
    expect(EXAMPLE_SNIPPET).toContain(`height="${figures.frameHeight}"`);
  });

  /* A script copied from the page reads only what an answer has. */
  it("read only fields an answer has, and test only statuses the routes send", () => {
    const read = [...EXAMPLE_FETCH.matchAll(/\bbody\.([A-Za-z]+(?:\.[A-Za-z]+)*)/g)].map(([, path]) => path!);
    const failureKeys = EMBED_STATUSES.flatMap(({ body }) => Object.keys(body ?? {}));
    const fieldPaths = EMBED_FIELDS.map(({ path }) => path as string);

    expect(read.length).toBeGreaterThan(4);
    for (const path of read) {
      const known = fieldPaths.includes(path) || failureKeys.includes(path);
      expect(known, path).toBe(true);
    }

    const tested = [...EXAMPLE_FETCH.matchAll(/status === (\d+)/g)].map(([, code]) => Number(code));
    /* Quoted words: the URL has a colon in it, the rest are the codes in the comment. */
    const named = [...EXAMPLE_FETCH.matchAll(/"([a-z-]+)"/g)].map(([, code]) => code!);
    const errors = EMBED_STATUSES.map(({ error }) => error);
    for (const code of tested) expect(EMBED_STATUSES.map(({ status }) => status), String(code)).toContain(code);
    for (const code of named) expect(errors, code).toContain(code);
    expect(named.sort()).toEqual(["not-a-pool", "unreadable"]);
  });

  it("are about a pool on a chain the site reads both protocols on", () => {
    expect(chainBySlug(EXAMPLE_RESPONSE.chain.slug)).toBe(ETHEREUM);
  });
});
