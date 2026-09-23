/*
 * The Telegram links out of Redis, or back in. Run by `backup.sh` and
 * `restore-backup.sh` under plain Node — no build, no Next — which is why it
 * imports its two modules with their extensions.
 *
 *   REDIS_URL=redis://127.0.0.1:6379/1 node store-backup.mts export > snapshot.json
 *   REDIS_URL=... node store-backup.mts restore [--replace] < snapshot.json
 *   node store-backup.mts describe < snapshot.json
 *
 * Everything that decides anything is in src/lib/backup/storeBackup.ts, under
 * test. This file is the socket.
 */

import { createConnection } from "node:net";

import {
  describeSnapshot,
  exportStore,
  readSnapshot,
  restoreStore,
  type Command,
} from "../src/lib/backup/storeBackup.ts";
import { decodeReply, encodeCommand, type RespReply } from "../src/lib/store/resp.ts";

const TIMEOUT_MS = 10_000;

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
};

/** One command at a time, each answered before the next is sent: RESP has no request ids. */
const connect = async (url: string): Promise<{ command: Command; close: () => void }> => {
  const address = new URL(url);
  if (address.protocol !== "redis:") throw new Error("REDIS_URL must be redis://");
  const database = address.pathname.replace(/^\//, "") || "0";
  if (!/^\d+$/.test(database)) throw new Error("REDIS_URL's database must be a number");

  const socket = createConnection({ host: address.hostname, port: Number(address.port || 6379) });
  let buffer = Buffer.alloc(0);
  let waiting: { resolve: (reply: RespReply) => void; reject: (error: Error) => void } | null = null;

  const failWith = (error: Error): void => {
    waiting?.reject(error);
    waiting = null;
    socket.destroy();
  };

  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    const decoded = decodeReply(buffer);
    if (decoded === "incomplete") return;
    if (decoded === "invalid") return failWith(new Error("Redis answered with something that is not RESP"));
    buffer = buffer.subarray(decoded.next);
    const current = waiting;
    waiting = null;
    current?.resolve(decoded.reply);
  });
  socket.on("error", failWith);
  socket.setTimeout(TIMEOUT_MS, () => failWith(new Error("Redis did not answer in time")));

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });

  const command: Command = (args) =>
    new Promise<RespReply>((resolve, reject) => {
      waiting = { resolve, reject };
      socket.write(encodeCommand(args));
    });

  const expectOk = async (args: readonly string[], what: string): Promise<void> => {
    const reply = await command(args);
    if (reply.kind === "error") throw new Error(`${what}: ${reply.message}`);
  };

  if (address.password) await expectOk(["AUTH", decodeURIComponent(address.password)], "AUTH");
  await expectOk(["SELECT", database], "SELECT");

  return { command, close: () => socket.end() };
};

const main = async (): Promise<void> => {
  const [action, ...flags] = process.argv.slice(2);

  if (action === "describe") {
    console.log(describeSnapshot(readSnapshot(await readStdin())));
    return;
  }

  if (action !== "export" && action !== "restore") {
    throw new Error("usage: store-backup.mts export | restore [--replace] | describe");
  }

  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is not set");

  // Read before connecting, so a bad file never opens a connection to the live store.
  const snapshot = action === "restore" ? readSnapshot(await readStdin()) : null;
  const { command, close } = await connect(url);
  try {
    if (snapshot === null) {
      process.stdout.write(`${JSON.stringify(await exportStore(command, Date.now()))}\n`);
    } else {
      const restored = await restoreStore(command, snapshot, Date.now(), { replace: flags.includes("--replace") });
      console.error(`restored ${restored} keys from the snapshot ${describeSnapshot(snapshot)}`);
    }
  } finally {
    close();
  }
};

main().catch((error: unknown) => {
  console.error(`store-backup: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
