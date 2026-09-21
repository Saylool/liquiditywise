/*
 * What this application asks of a store, and nothing more.
 *
 * Six commands, because six is what the Telegram links need: a record read,
 * written and removed, and a set of tokens added to, taken from and listed.
 * Small on purpose — it is the whole surface two implementations have to
 * agree on, and the whole surface a fake in a test has to provide.
 *
 * Every method answers rather than throws, and the three-valued `get` is the
 * distinction the rest of the application is built on: `null` is the store
 * saying there is no such key, `undefined` is the store not answering. A
 * webhook must not tell someone their link is unknown because a database was
 * slow.
 */
export type KeyValueStore = {
  readonly get: (key: string) => Promise<string | null | undefined>;
  readonly set: (key: string, value: string, ttlMs?: number) => Promise<boolean>;
  readonly del: (key: string) => Promise<boolean>;
  readonly sadd: (key: string, member: string) => Promise<boolean>;
  readonly srem: (key: string, member: string) => Promise<boolean>;
  readonly smembers: (key: string) => Promise<readonly string[] | null>;
};
