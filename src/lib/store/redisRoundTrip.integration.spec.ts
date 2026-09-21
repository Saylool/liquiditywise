import { createServer, type Server, type Socket } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { nodeRedisConnect } from "./nodeRedisSocket";
import { createRedisClient, parseRedisUrl, type RedisClient } from "./redisClient";
import { createRedisKeyValueStore } from "./redisKeyValueStore";
import { decodeReply, encodeCommand } from "./resp";

/*
 * The one test that opens a real socket.
 *
 * Everything else here hands the client a `RedisSocket` a test wrote, which
 * is what makes the failure modes reachable — but it also means `node:net`,
 * the connect timeout and the chunking a kernel really does are covered by
 * nothing. This covers them, against a server that speaks the protocol from
 * the other side: it *parses* commands where the client *encodes* them, so
 * a mistake shared by both would have to be made twice, in opposite
 * directions.
 *
 * It binds a port, so it is excluded from the default run — the sandbox this
 * project is developed in cannot listen. Run it where a port can be opened:
 *
 *   npx vitest run --config vitest.integration.mts
 */

/** Enough of a Redis to answer the eight commands this application sends. */
const startFakeRedis = (options: { password?: string } = {}) => {
  const values = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const seen: string[][] = [];
  let authenticated = options.password === undefined;

  const reply = (socket: Socket, text: string): void => {
    socket.write(Buffer.from(text, "utf8"));
  };

  const handle = (socket: Socket, args: string[]): void => {
    seen.push(args);
    const [name = "", ...rest] = args;

    if (!authenticated && name.toUpperCase() !== "AUTH") {
      reply(socket, "-NOAUTH Authentication required.\r\n");
      return;
    }

    switch (name.toUpperCase()) {
      case "AUTH":
        if (rest[0] === options.password) {
          authenticated = true;
          reply(socket, "+OK\r\n");
        } else {
          reply(socket, "-WRONGPASS invalid password\r\n");
        }
        return;
      case "SELECT":
        reply(socket, "+OK\r\n");
        return;
      case "SET": {
        const [key = "", value = ""] = rest;
        values.set(key, value);
        reply(socket, "+OK\r\n");
        return;
      }
      case "GET": {
        const value = values.get(rest[0] ?? "");
        reply(
          socket,
          value === undefined ? "$-1\r\n" : `$${Buffer.byteLength(value)}\r\n${value}\r\n`,
        );
        return;
      }
      case "DEL":
        reply(socket, `:${values.delete(rest[0] ?? "") ? 1 : 0}\r\n`);
        return;
      case "SADD": {
        const [key = "", member = ""] = rest;
        const set = sets.get(key) ?? new Set<string>();
        sets.set(key, set);
        const added = set.has(member) ? 0 : 1;
        set.add(member);
        reply(socket, `:${added}\r\n`);
        return;
      }
      case "SREM": {
        const [key = "", member = ""] = rest;
        reply(socket, `:${sets.get(key)?.delete(member) ? 1 : 0}\r\n`);
        return;
      }
      case "SMEMBERS": {
        const members = [...(sets.get(rest[0] ?? "") ?? [])];
        const body = members
          .map((member) => `$${Buffer.byteLength(member)}\r\n${member}\r\n`)
          .join("");
        reply(socket, `*${members.length}\r\n${body}`);
        return;
      }
      default:
        reply(socket, "-ERR unknown command\r\n");
    }
  };

  /* The request side, parsed with the decoder: a command is an array of bulk strings. */
  const server: Server = createServer((socket) => {
    let buffer: Buffer = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      for (;;) {
        const decoded = decodeReply(buffer);
        if (decoded === "incomplete") return;
        if (decoded === "invalid") {
          socket.destroy();
          return;
        }

        buffer = buffer.subarray(decoded.next);
        const { reply: parsed } = decoded;
        if (parsed.kind !== "array") {
          socket.destroy();
          return;
        }

        handle(
          socket,
          parsed.values.map((value) => (value.kind === "string" ? value.value : "")),
        );
      }
    });
    socket.on("error", () => {});
  });

  return {
    listen: () =>
      new Promise<number>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          resolve(typeof address === "object" && address !== null ? address.port : 0);
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
    seen,
  };
};

describe("the Redis store over a real socket", () => {
  let redis: ReturnType<typeof startFakeRedis>;
  let port = 0;
  const opened: RedisClient[] = [];

  /*
   * Every client is kept so it can be closed. A connection left open holds
   * the server's `close` for ever — which is a leak in the test rather than
   * in the client, and exactly the kind that makes a suite hang at the end
   * and get force-quit instead of read.
   */
  const storeOn = (url: string) => {
    const address = parseRedisUrl(url);
    if (address === null) throw new Error("the URL this test wrote should parse");

    const client = createRedisClient({
      connect: nodeRedisConnect(address),
      password: address.password,
      database: address.database,
    });
    opened.push(client);

    return createRedisKeyValueStore(client);
  };

  beforeAll(async () => {
    redis = startFakeRedis({ password: "hunter2" });
    port = await redis.listen();
  });

  afterAll(async () => {
    for (const client of opened) client.close();
    await redis.close();
  });

  it("carries a value there and back", async () => {
    const store = storeOn(`redis://:hunter2@127.0.0.1:${port}/1`);

    expect(await store.get("liquiditywise:absent")).toBeNull();
    expect(await store.set("liquiditywise:k", "v", 60_000)).toBe(true);
    expect(await store.get("liquiditywise:k")).toBe("v");

    expect(await store.sadd("liquiditywise:s", "a")).toBe(true);
    expect(await store.sadd("liquiditywise:s", "b")).toBe(true);
    expect(await store.smembers("liquiditywise:s")).toEqual(["a", "b"]);
    expect(await store.srem("liquiditywise:s", "a")).toBe(true);
    expect(await store.smembers("liquiditywise:s")).toEqual(["b"]);

    expect(await store.del("liquiditywise:k")).toBe(true);
    expect(await store.get("liquiditywise:k")).toBeNull();

    /* The handshake really happened, and before anything else. */
    expect(redis.seen[0]).toEqual(["AUTH", "hunter2"]);
    expect(redis.seen[1]).toEqual(["SELECT", "1"]);
    expect(redis.seen.some((command) => command[0] === "SET" && command[3] === "PX")).toBe(true);
  });

  it("carries a value longer than one packet", async () => {
    const store = storeOn(`redis://:hunter2@127.0.0.1:${port}`);

    /* Past any plausible MTU, so the reply arrives in pieces a real kernel chose. */
    const long = "x".repeat(400_000);
    expect(await store.set("liquiditywise:long", long)).toBe(true);
    expect(await store.get("liquiditywise:long")).toBe(long);
  });

  it("answers null rather than hanging when nothing is listening", async () => {
    const closed = startFakeRedis();
    const free = await closed.listen();
    await closed.close();

    const client = createRedisClient({
      connect: nodeRedisConnect(
        { host: "127.0.0.1", port: free, password: undefined, database: undefined },
        500,
      ),
    });
    opened.push(client);
    const store = createRedisKeyValueStore(client);

    expect(await store.get("liquiditywise:k")).toBeUndefined();
    expect(await store.smembers("liquiditywise:s")).toBeNull();
  });

  it("refuses the connection when the password is wrong, without writing the command", async () => {
    const store = storeOn(`redis://:wrong@127.0.0.1:${port}`);

    expect(await store.get("liquiditywise:k")).toBeUndefined();
  });

  it("encodes what the server parses back", () => {
    /* The two directions meeting: written by one side, read by the other. */
    const encoded = encodeCommand(["SET", "k", "değer"]);
    const decoded = decodeReply(encoded);
    if (decoded === "incomplete" || decoded === "invalid") throw new Error(decoded);

    expect(decoded.reply).toEqual({
      kind: "array",
      values: [
        { kind: "string", value: "SET" },
        { kind: "string", value: "k" },
        { kind: "string", value: "değer" },
      ],
    });
  });
});
