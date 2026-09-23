/*
 * Where the daily backup of the Telegram links is kept.
 *
 * A Worker on liquiditywise.com/__backup/*, in front of a KV namespace, so the
 * server needs no Cloudflare credential at all: it holds one random secret,
 * shared with this Worker and nothing else, and the Worker is the only thing
 * that can write to the namespace. What the server sends is already
 * encrypted to a key the server does not have; this never sees a link.
 *
 * It keeps a copy for seven days and then KV deletes it — the promise the site
 * makes readers, held to that number by a test.
 *
 * It accepts only today's copy. The server is the one thing that can reach
 * this with the secret, so a server someone else controls could send
 * anything; what it cannot do is reach back and overwrite the days before the
 * one it was taken over on. There is no delete.
 *
 * Anything without the secret gets the same 404 as an address that does not
 * exist, so the route says nothing about itself to whoever finds it.
 */

type KvNamespace = {
  readonly get: (key: string, type: "arrayBuffer") => Promise<ArrayBuffer | null>;
  readonly put: (key: string, value: ArrayBuffer, options: { expirationTtl: number }) => Promise<void>;
  readonly list: (options: { prefix: string }) => Promise<{ keys: readonly { name: string }[] }>;
};

export type Env = {
  readonly BACKUPS: KvNamespace;
  /** Set with `wrangler secret put`, from the server's .env.local, never in a file here. */
  readonly BACKUP_SECRET?: string;
};

/** Seven days. What readers are told: out of the backups within seven days of /stop. */
export const KEEP_SECONDS = 7 * 24 * 60 * 60;

/** A copy is kilobytes today. Twenty megabytes is a hundred thousand links, and under KV's limit. */
export const MAX_BYTES = 20 * 1024 * 1024;

/** A secret shorter than this is a mistake, and a Worker with one would be guessable. */
const MIN_SECRET_LENGTH = 32;

/** `backup` for the daily copies; `proof` for a restore proven on made-up links. */
const NAMES = new Set(["backup", "proof"]);

const DAY_MS = 24 * 60 * 60 * 1_000;

const nothing = (): Response => new Response("Not found", { status: 404 });

const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const digest = async (text: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

/** Compared as digests, byte by byte to the end, so the time taken says nothing about how close a guess was. */
const holdsSecret = async (request: Request, secret: string | undefined): Promise<boolean> => {
  if (secret === undefined || secret.length < MIN_SECRET_LENGTH) return false;
  const [given, expected] = await Promise.all([
    digest(request.headers.get("authorization") ?? ""),
    digest(`Bearer ${secret}`),
  ]);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= (given[index] ?? 0) ^ (expected[index] ?? 0);
  return difference === 0;
};

export const handle = async (request: Request, env: Env, nowMs = Date.now()): Promise<Response> => {
  if (!(await holdsSecret(request, env.BACKUP_SECRET))) return nothing();

  const match = /^\/__backup\/([a-z]+)\/(\d{4}-\d{2}-\d{2})?$/.exec(new URL(request.url).pathname);
  const name = match?.[1];
  const day = match?.[2];
  if (name === undefined || !NAMES.has(name)) return nothing();

  if (day === undefined) {
    if (request.method !== "GET") return nothing();
    const { keys } = await env.BACKUPS.list({ prefix: `${name}/` });
    return Response.json(keys.map((key) => key.name.slice(name.length + 1)).sort());
  }

  const key = `${name}/${day}`;

  if (request.method === "GET") {
    const stored = await env.BACKUPS.get(key, "arrayBuffer");
    return stored === null
      ? nothing()
      : new Response(stored, { headers: { "Content-Type": "application/octet-stream" } });
  }

  if (request.method === "PUT") {
    // Today, or yesterday for a run that started a moment before midnight.
    if (day !== dayOf(nowMs) && day !== dayOf(nowMs - DAY_MS)) {
      return new Response("Only today's backup can be written", { status: 403 });
    }
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) return new Response("Too large", { status: 413 });
    const body = await request.arrayBuffer();
    if (body.byteLength === 0) return new Response("Empty", { status: 400 });
    if (body.byteLength > MAX_BYTES) return new Response("Too large", { status: 413 });

    await env.BACKUPS.put(key, body, { expirationTtl: KEEP_SECONDS });
    return new Response(null, { status: 204 });
  }

  return nothing();
};

const worker = {
  fetch: (request: Request, env: Env): Promise<Response> => handle(request, env),
};

export default worker;
