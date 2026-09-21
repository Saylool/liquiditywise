import { decodeReply, encodeCommand, type RespReply } from "./resp";

/*
 * One connection to a Redis, and the rules for what happens when it fails.
 *
 * The contract is the one every store in this application keeps: nothing
 * here throws, and everything that did not work comes back as `null`. The
 * callers cannot act differently on a refused password, an unreachable host
 * and a slow answer — they have a page to render or a webhook to answer
 * either way — so the distinction is not offered and cannot be forgotten.
 *
 * RESP carries no request ids: replies are matched to commands by order
 * alone. That is what makes a timeout different here from a timeout over
 * HTTP — a late reply would be handed to the *next* command — so a command
 * that times out, or a stream that stops being RESP, drops the connection
 * rather than carrying on from a place that cannot be trusted.
 *
 * The socket is injected, so every one of those failures is a test rather
 * than something waited for in production.
 */

/** The little of a socket this needs, so a test can be a few lines. */
export type RedisSocket = {
  readonly write: (data: Buffer) => void;
  readonly onData: (listener: (chunk: Buffer) => void) => void;
  /** Called on close and on error alike: both mean the connection is gone. */
  readonly onClose: (listener: () => void) => void;
  readonly destroy: () => void;
};

/** Opens one connection, or answers `null` when it could not. Never throws. */
export type RedisConnect = () => Promise<RedisSocket | null>;

export const DEFAULT_REDIS_TIMEOUT_MS = 2_000;

export type RedisClientOptions = {
  readonly connect: RedisConnect;
  /** Sent as `AUTH` before anything else, when the URL carried one. */
  readonly password?: string | undefined;
  /** Sent as `SELECT`, so a shared Redis can keep this application's keys apart. */
  readonly database?: number | undefined;
  readonly timeoutMs?: number | undefined;
};

export type RedisClient = {
  /** One command. `null` when it could not be completed, for any reason. */
  readonly command: (args: readonly string[]) => Promise<RespReply | null>;
  readonly close: () => void;
};

type Pending = {
  readonly settle: (reply: RespReply | null) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

export const createRedisClient = ({
  connect,
  password,
  database,
  timeoutMs = DEFAULT_REDIS_TIMEOUT_MS,
}: RedisClientOptions): RedisClient => {
  let socket: RedisSocket | null = null;
  let opening: Promise<RedisSocket | null> | null = null;
  let buffer: Buffer = Buffer.alloc(0);
  let pending: Pending[] = [];

  /** Ends the connection and fails everything waiting on it. Safe to call twice. */
  const drop = (): void => {
    const waiting = pending;
    pending = [];
    buffer = Buffer.alloc(0);

    const dying = socket;
    socket = null;
    opening = null;

    for (const item of waiting) {
      clearTimeout(item.timer);
      item.settle(null);
    }

    dying?.destroy();
  };

  const receive = (chunk: Buffer): void => {
    buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);

    for (;;) {
      const decoded = decodeReply(buffer);
      if (decoded === "incomplete") return;
      if (decoded === "invalid") {
        // Not RESP any more. Anything read from here would be a guess.
        drop();
        return;
      }

      buffer = buffer.subarray(decoded.next);

      const next = pending.shift();
      if (next === undefined) {
        /*
         * A reply nobody is waiting for. Either the server spoke first or a
         * previous command was abandoned, and in both cases the ordering this
         * protocol relies on is already lost.
         */
        drop();
        return;
      }

      clearTimeout(next.timer);
      next.settle(decoded.reply);
    }
  };

  /** Writes a command onto an open socket. The caller has the socket already. */
  const send = (open: RedisSocket, args: readonly string[]): Promise<RespReply | null> =>
    new Promise((resolve) => {
      let settled = false;
      const settle = (reply: RespReply | null): void => {
        if (settled) return;
        settled = true;
        resolve(reply);
      };

      const timer = setTimeout(() => {
        settle(null);
        // The reply may still arrive, and it would be read as the next
        // command's. There is no way back to a known state but a new one.
        drop();
      }, timeoutMs);

      pending.push({ settle, timer });

      try {
        open.write(encodeCommand(args));
      } catch {
        clearTimeout(timer);
        settle(null);
        drop();
      }
    });

  const ensureSocket = async (): Promise<RedisSocket | null> => {
    if (socket !== null) return socket;
    if (opening !== null) return opening;

    opening = (async (): Promise<RedisSocket | null> => {
      let opened: RedisSocket | null = null;
      try {
        opened = await connect();
      } catch {
        opened = null;
      }
      if (opened === null) return null;

      opened.onData(receive);
      opened.onClose(drop);
      socket = opened;

      /*
       * The handshake runs before the connection is handed out, so a refused
       * password is a connection that never existed rather than a command
       * that failed oddly. Both replies are awaited in the order they were
       * written, which is the order this protocol answers in.
       */
      const greetings: string[][] = [];
      if (password !== undefined && password !== "") greetings.push(["AUTH", password]);
      if (database !== undefined && database !== 0) greetings.push(["SELECT", String(database)]);

      for (const greeting of greetings) {
        const reply = await send(opened, greeting);
        if (reply === null) return null;
        if (reply.kind !== "string") {
          drop();
          return null;
        }
      }

      return socket;
    })();

    const result = await opening;
    /*
     * Cleared only when the attempt failed. On success `opening` is left
     * holding the resolved promise, which costs nothing and means a burst of
     * commands arriving together shares one connection attempt rather than
     * racing to make several.
     */
    if (result === null) opening = null;

    return result;
  };

  return {
    command: async (args) => {
      const open = await ensureSocket();
      if (open === null) return null;

      return send(open, args);
    },
    close: drop,
  };
};

export type RedisAddress = {
  readonly host: string;
  readonly port: number;
  readonly password: string | undefined;
  readonly database: number | undefined;
};

/**
 * Reads `redis://[:password@]host[:port][/database]`.
 *
 * `rediss://` is deliberately not accepted. This connection is meant to be to
 * a Redis on the same machine or on a private network, where TLS adds a
 * failure mode rather than a guarantee; anything further away should go
 * through the REST store next door, which is HTTPS all the way.
 *
 * `null` for anything it cannot read, which the caller treats as "no Redis
 * configured" — a URL with a typo in it must not look like a working one.
 */
export const parseRedisUrl = (raw: string | undefined): RedisAddress | null => {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === "") return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "redis:") return null;
  if (url.hostname === "") return null;

  const port = url.port === "" ? 6379 : Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;

  const path = url.pathname.replace(/^\//, "");
  const database = path === "" ? undefined : Number(path);
  if (database !== undefined && (!Number.isInteger(database) || database < 0 || database > 15)) {
    return null;
  }

  /* Redis's own URL form puts the password where a URL puts the password. */
  const password = decodeURIComponent(url.password) || undefined;

  return { host: url.hostname, port, password, database };
};
