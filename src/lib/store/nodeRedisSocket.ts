import "server-only";

import { createConnection, type Socket } from "node:net";

import type { RedisAddress, RedisConnect, RedisSocket } from "./redisClient";

/*
 * A real TCP socket, wrapped in the four methods the client uses.
 *
 * The only file here that touches `node:net`, and the reason the client is
 * testable: everything above this line is handed a `RedisSocket` and cannot
 * tell a real one from one a test wrote in ten lines.
 *
 * `server-only`, because a Redis address is deployment configuration and a
 * socket is not something a browser bundle should even be asked to consider.
 */

export const DEFAULT_CONNECT_TIMEOUT_MS = 2_000;

const wrap = (socket: Socket): RedisSocket => ({
  write: (data) => {
    socket.write(data);
  },
  onData: (listener) => {
    socket.on("data", listener);
  },
  onClose: (listener) => {
    // Both, because both mean the same thing to the client and either can
    // arrive first. Calling it twice is safe; the client's drop is.
    socket.on("close", listener);
    socket.on("error", listener);
  },
  destroy: () => {
    socket.destroy();
  },
});

/**
 * Opens one connection, or answers `null`.
 *
 * Its own timeout, separate from the one on a command: a host that accepts
 * nothing leaves a connect attempt hanging for as long as the kernel allows,
 * which on a page render is indistinguishable from a broken site.
 */
export const nodeRedisConnect = (
  address: RedisAddress,
  timeoutMs: number = DEFAULT_CONNECT_TIMEOUT_MS,
): RedisConnect => {
  return () =>
    new Promise<RedisSocket | null>((resolve) => {
      let settled = false;
      const socket = createConnection({ host: address.host, port: address.port });

      const settle = (value: RedisSocket | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.off("connect", onConnect);
        socket.off("error", onFailure);
        if (value === null) socket.destroy();
        resolve(value);
      };

      const onConnect = (): void => {
        // Nagle's algorithm would hold a command back waiting for more to
        // send, and there never is more: this writes one command and waits.
        socket.setNoDelay(true);
        settle(wrap(socket));
      };

      const onFailure = (): void => {
        settle(null);
      };

      const timer = setTimeout(onFailure, timeoutMs);

      socket.once("connect", onConnect);
      socket.once("error", onFailure);
    });
};
