/*
 * What this application asks of a store, and nothing more.
 *
 * Six commands, because six is what the Telegram links need: a record read,
 * written and removed, and a set of tokens added to, taken from and listed.
 * And two that bound them: a set's size, which is how a ceiling on the links
 * is read without listing them, and a counter that counts and expires in one
 * step, which is how the public actions that write here are budgeted
 * (ratelimit/actionBudget.ts). Small on purpose — it is the whole surface two
 * implementations have to agree on, and the whole surface a fake in a test has
 * to provide.
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
  /** How many members a set has; zero for one that does not exist, `null` when the store did not answer. */
  readonly scard: (key: string) => Promise<number | null>;
  /**
   * Adds one to a counter and answers the new count, `null` when the store did
   * not answer. The first count of a key gives it `ttlMs` to live, in the same
   * step: a counter that could be left without a lifetime by a crash between
   * two commands would be a client refused for ever.
   */
  readonly increment: (key: string, ttlMs: number) => Promise<number | null>;
};

/*
 * The counter's one step, as a script Redis runs whole: nothing else is run
 * between the INCR and the PEXPIRE, so no count is ever left without a
 * lifetime. Every Redis since 2.6 runs one, and Upstash's REST API takes the
 * same EVAL. `PEXPIRE … NX` would do it in two commands without a script, but
 * only from Redis 7, and the server's Redis is whatever its distribution ships.
 */
export const INCREMENT_SCRIPT =
  "local n = redis.call('INCR', KEYS[1]) if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return n";
