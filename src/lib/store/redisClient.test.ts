import { describe, expect, it, vi } from "vitest";

import { fakeSocket } from "./fakeSocket";
import { createRedisClient, parseRedisUrl, type RedisSocket } from "./redisClient";

const connected = (options: { password?: string; database?: number } = {}) => {
  const fake = fakeSocket();
  const client = createRedisClient({ connect: async () => fake.socket, timeoutMs: 50, ...options });

  return { fake, client };
};

describe("createRedisClient", () => {
  it("writes a command and reads its reply", async () => {
    const { fake, client } = connected();

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("$5\r\nhello\r\n");

    expect(await pending).toEqual({ kind: "string", value: "hello" });
    expect(fake.commands()).toEqual(["GET k"]);
  });

  it("assembles a reply that arrives in pieces", async () => {
    const { fake, client } = connected();

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("$5\r\nhel");
    fake.reply("lo\r\n");

    expect(await pending).toEqual({ kind: "string", value: "hello" });
  });

  it("matches replies to commands in order when several are in flight", async () => {
    const { fake, client } = connected();

    const first = client.command(["GET", "a"]);
    const second = client.command(["GET", "b"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(2));
    fake.reply("$1\r\n1\r\n$1\r\n2\r\n");

    expect(await first).toEqual({ kind: "string", value: "1" });
    expect(await second).toEqual({ kind: "string", value: "2" });
  });

  it("hands an error reply back rather than throwing", async () => {
    const { fake, client } = connected();

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("-WRONGTYPE nope\r\n");

    expect(await pending).toEqual({ kind: "error", message: "WRONGTYPE nope" });
  });

  it("answers null when there is no connection to be had", async () => {
    const client = createRedisClient({ connect: async () => null, timeoutMs: 50 });

    expect(await client.command(["GET", "k"])).toBeNull();
  });

  it("answers null when opening the connection throws", async () => {
    const client = createRedisClient({
      connect: () => Promise.reject(new Error("refused")),
      timeoutMs: 50,
    });

    expect(await client.command(["GET", "k"])).toBeNull();
  });

  it("fails everything in flight when the connection dies", async () => {
    const { fake, client } = connected();

    const first = client.command(["GET", "a"]);
    const second = client.command(["GET", "b"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(2));
    fake.close();

    expect(await first).toBeNull();
    expect(await second).toBeNull();
  });

  it("drops the connection on a timeout, so a late reply cannot answer the next command", async () => {
    const { fake, client } = connected();

    expect(await client.command(["GET", "slow"])).toBeNull();
    expect(fake.destroyed).toBe(true);
  });

  it("drops the connection on a stream that is not RESP", async () => {
    const { fake, client } = connected();

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("not resp at all\r\n");

    /*
     * At once, not once the command times out. Waiting for the timeout would
     * pass whether or not the desynchronised connection was ever dropped,
     * and being dropped is the whole claim.
     */
    expect(fake.destroyed).toBe(true);
    expect(await pending).toBeNull();
  });

  it("drops the connection on a reply nobody asked for", async () => {
    const { fake, client } = connected();

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("+OK\r\n+OK\r\n");

    expect(fake.destroyed).toBe(true);
    expect(await pending).toEqual({ kind: "string", value: "OK" });
  });

  it("opens a new connection after the old one failed", async () => {
    const first = fakeSocket();
    const second = fakeSocket();
    const sockets = [first.socket, second.socket];
    const client = createRedisClient({
      connect: async () => sockets.shift() ?? null,
      timeoutMs: 50,
    });

    const failing = client.command(["GET", "a"]);
    await vi.waitFor(() => expect(first.writes).toHaveLength(1));
    first.close();
    expect(await failing).toBeNull();

    const pending = client.command(["GET", "b"]);
    await vi.waitFor(() => expect(second.writes).toHaveLength(1));
    second.reply("$1\r\n2\r\n");

    expect(await pending).toEqual({ kind: "string", value: "2" });
  });

  it("opens one connection for a burst of commands, not one each", async () => {
    const fake = fakeSocket();
    const connect = vi.fn(async () => fake.socket);
    const client = createRedisClient({ connect, timeoutMs: 50 });

    const all = Promise.all([client.command(["GET", "a"]), client.command(["GET", "b"])]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(2));
    fake.reply("$1\r\n1\r\n$1\r\n2\r\n");
    await all;

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("authenticates and selects the database before any command", async () => {
    const { fake, client } = connected({ password: "s3cret", database: 3 });

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("+OK\r\n");
    await vi.waitFor(() => expect(fake.writes).toHaveLength(2));
    fake.reply("+OK\r\n");
    await vi.waitFor(() => expect(fake.writes).toHaveLength(3));
    fake.reply("$1\r\nv\r\n");

    expect(await pending).toEqual({ kind: "string", value: "v" });
    expect(fake.commands()).toEqual(["AUTH s3cret", "SELECT 3", "GET k"]);
  });

  it("sends neither when the URL carried neither", async () => {
    const { fake, client } = connected();

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("$1\r\nv\r\n");

    await pending;
    expect(fake.commands()).toEqual(["GET k"]);
  });

  it("selects nothing for database zero, which is the one Redis is already on", async () => {
    const { fake, client } = connected({ database: 0 });

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("$1\r\nv\r\n");

    await pending;
    expect(fake.commands()).toEqual(["GET k"]);
  });

  it("refuses the connection when the password is refused", async () => {
    const { fake, client } = connected({ password: "wrong" });

    const pending = client.command(["GET", "k"]);
    await vi.waitFor(() => expect(fake.writes).toHaveLength(1));
    fake.reply("-WRONGPASS no\r\n");

    expect(await pending).toBeNull();
    expect(fake.destroyed).toBe(true);
    /* The command itself was never written. */
    expect(fake.commands()).toEqual(["AUTH wrong"]);
  });

  it("answers null when writing to the socket throws", async () => {
    const throwing: RedisSocket = {
      write: () => {
        throw new Error("broken pipe");
      },
      onData: () => {},
      onClose: () => {},
      destroy: () => {},
    };
    const client = createRedisClient({ connect: async () => throwing, timeoutMs: 50 });

    expect(await client.command(["GET", "k"])).toBeNull();
  });

  it("closes on request", async () => {
    const { fake, client } = connected();

    await client.command(["GET", "k"]).catch(() => null);
    client.close();

    expect(fake.destroyed).toBe(true);
  });
});

describe("parseRedisUrl", () => {
  it("reads host and port, defaulting the port", () => {
    expect(parseRedisUrl("redis://127.0.0.1:6380")).toEqual({
      host: "127.0.0.1",
      port: 6380,
      password: undefined,
      database: undefined,
    });
    expect(parseRedisUrl("redis://127.0.0.1")?.port).toBe(6379);
  });

  it("reads a password and a database index", () => {
    expect(parseRedisUrl("redis://:hunter2@127.0.0.1:6379/1")).toEqual({
      host: "127.0.0.1",
      port: 6379,
      password: "hunter2",
      database: 1,
    });
  });

  it("decodes a password written with URL escapes", () => {
    expect(parseRedisUrl("redis://:a%40b%3Ac@127.0.0.1")?.password).toBe("a@b:c");
  });

  it("treats database zero as nothing to select", () => {
    expect(parseRedisUrl("redis://127.0.0.1/0")?.database).toBe(0);
  });

  it("refuses what it cannot read, rather than guessing a default", () => {
    expect(parseRedisUrl(undefined)).toBeNull();
    expect(parseRedisUrl("")).toBeNull();
    expect(parseRedisUrl("   ")).toBeNull();
    expect(parseRedisUrl("127.0.0.1:6379")).toBeNull();
    expect(parseRedisUrl("redis://")).toBeNull();
    expect(parseRedisUrl("redis://127.0.0.1/99")).toBeNull();
    expect(parseRedisUrl("redis://127.0.0.1/abc")).toBeNull();
  });

  it("refuses rediss://, which this client does not speak", () => {
    expect(parseRedisUrl("rediss://127.0.0.1:6379")).toBeNull();
    expect(parseRedisUrl("http://127.0.0.1:6379")).toBeNull();
  });
});
