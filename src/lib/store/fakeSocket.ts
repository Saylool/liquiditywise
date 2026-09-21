import type { RedisSocket } from "./redisClient";

/**
 * A socket a test drives: it records what was written and answers when the
 * test says so. Everything the real client has to cope with — a reply in two
 * pieces, a stream that stops being RESP, a connection that dies mid-command
 * — is a method call here rather than something waited for.
 */
export const fakeSocket = () => {
  let onData: ((chunk: Buffer) => void) | null = null;
  const closers: (() => void)[] = [];
  const writes: string[] = [];
  let destroyed = false;

  const socket: RedisSocket = {
    write: (data) => {
      if (destroyed) throw new Error("write after destroy");
      writes.push(data.toString("utf8"));
    },
    onData: (listener) => {
      onData = listener;
    },
    onClose: (listener) => {
      closers.push(listener);
    },
    destroy: () => {
      destroyed = true;
    },
  };

  return {
    socket,
    writes,
    get destroyed() {
      return destroyed;
    },
    /** What the server says next. */
    reply: (text: string) => onData?.(Buffer.from(text, "utf8")),
    /** The connection going away by itself. */
    close: () => {
      destroyed = true;
      for (const closer of [...closers]) closer();
    },
    /** The commands written, as Redis would have read them. */
    commands: () =>
      writes.map((write) =>
        write
          .split("\r\n")
          .filter((line, index) => index > 0 && !line.startsWith("$") && line !== "")
          .join(" "),
      ),
  };
};
