/*
 * Redis's own wire protocol, RESP2, in the two directions this application
 * needs it.
 *
 * Written here rather than taken from a package for the same reason the
 * keccak and the ABI decoding are: it is a small, fixed, well-documented
 * format, the commands used are eight, and a dependency in front of the one
 * place that stores anything about a reader is a dependency that would have
 * to be trusted rather than read.
 *
 * Pure. No socket, no clock, no state — which is what lets every shape a
 * server can answer with be a test rather than a thing observed in
 * production.
 */

const CRLF = "\r\n";

/**
 * A command, as Redis wants it: an array of bulk strings.
 *
 * Lengths are counted in bytes rather than characters. A key holding a
 * non-ASCII character — which a token or an address never does, but a value
 * written by a future caller might — is one byte per character in neither
 * direction, and a length that counts characters desynchronises the stream
 * for every command after it.
 */
export const encodeCommand = (args: readonly string[]): Buffer => {
  const parts: string[] = [`*${args.length}${CRLF}`];

  for (const arg of args) {
    parts.push(`$${Buffer.byteLength(arg, "utf8")}${CRLF}${arg}${CRLF}`);
  }

  return Buffer.from(parts.join(""), "utf8");
};

/** What a server can answer. `null` covers both the null bulk string and the null array. */
export type RespReply =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "integer"; readonly value: number }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "null" }
  | { readonly kind: "array"; readonly values: readonly RespReply[] };

export type DecodedReply = { readonly reply: RespReply; readonly next: number };

/**
 * One reply out of a buffer, or why there is not one.
 *
 * Three outcomes rather than two, because they call for different things:
 * `"incomplete"` means wait for more bytes, and `"invalid"` means this is not
 * RESP at all and the connection has to be dropped — carrying on from a
 * desynchronised stream would answer one command with another's reply, which
 * is worse than failing.
 */
export const decodeReply = (
  buffer: Buffer,
  offset = 0,
): DecodedReply | "incomplete" | "invalid" => {
  const marker = buffer[offset];
  if (marker === undefined) return "incomplete";

  const lineEnd = buffer.indexOf(CRLF, offset);
  if (lineEnd < 0) return "incomplete";

  const head = buffer.toString("utf8", offset + 1, lineEnd);
  const next = lineEnd + 2;

  switch (String.fromCharCode(marker)) {
    case "+":
      return { reply: { kind: "string", value: head }, next };

    case "-":
      return { reply: { kind: "error", message: head }, next };

    case ":": {
      const value = Number(head);
      /*
       * Redis integers are 64-bit and this reads them into a double, so one
       * past 2^53 would arrive quietly rounded. None of the commands here can
       * produce one — a counter, a set's size, a deletion count — and a
       * reading that cannot be exact is refused rather than rounded.
       */
      return Number.isSafeInteger(value)
        ? { reply: { kind: "integer", value }, next }
        : "invalid";
    }

    case "$": {
      const length = Number(head);
      if (!Number.isSafeInteger(length)) return "invalid";
      if (length < 0) return { reply: { kind: "null" }, next };

      const bodyEnd = next + length;
      // The body, and the CRLF that follows it.
      if (buffer.length < bodyEnd + 2) return "incomplete";

      return { reply: { kind: "string", value: buffer.toString("utf8", next, bodyEnd) }, next: bodyEnd + 2 };
    }

    case "*": {
      const count = Number(head);
      if (!Number.isSafeInteger(count)) return "invalid";
      if (count < 0) return { reply: { kind: "null" }, next };

      const values: RespReply[] = [];
      let cursor = next;

      for (let index = 0; index < count; index += 1) {
        const item = decodeReply(buffer, cursor);
        if (item === "incomplete" || item === "invalid") return item;

        values.push(item.reply);
        cursor = item.next;
      }

      return { reply: { kind: "array", values }, next: cursor };
    }

    default:
      return "invalid";
  }
};
