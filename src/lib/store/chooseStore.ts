import { parseRedisUrl, type RedisAddress } from "./redisClient";

/*
 * Which store this deployment is configured for, decided without building
 * one.
 *
 * Separate from the building so that the decision — the part with rules in
 * it — is a pure function this application can hold to a test, while the
 * part that opens sockets stays a few lines with nothing to get wrong.
 *
 * A Redis wins when there is one. It is the arrangement this application is
 * meant to run in: a database on the same machine, reached over loopback,
 * holding the only thing kept about anybody. The REST store is for a
 * deployment with nowhere to run one — a platform of short-lived processes,
 * which is where this application used to live.
 */

export type StoreEnvironment = {
  readonly REDIS_URL?: string | undefined;
  readonly UPSTASH_REDIS_REST_URL?: string | undefined;
  readonly UPSTASH_REDIS_REST_TOKEN?: string | undefined;
};

export type StoreChoice =
  | { readonly kind: "redis"; readonly address: RedisAddress }
  | { readonly kind: "upstash"; readonly url: string; readonly token: string };

const present = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? null : trimmed;
};

/**
 * `null` when this deployment has no store, which is a state the callers
 * handle rather than an error: without one there are no Telegram alerts, and
 * the page says so.
 *
 * A `REDIS_URL` that cannot be read is not quietly stepped over. It is
 * somebody's attempt to configure a Redis, and falling back to a REST
 * database on the strength of a typo would hide the mistake behind a store
 * that works — so a URL that is set and unreadable means no store at all.
 */
export const chooseStore = (environment: StoreEnvironment): StoreChoice | null => {
  const redisUrl = present(environment.REDIS_URL);
  if (redisUrl !== null) {
    const address = parseRedisUrl(redisUrl);

    return address === null ? null : { kind: "redis", address };
  }

  const url = present(environment.UPSTASH_REDIS_REST_URL);
  const token = present(environment.UPSTASH_REDIS_REST_TOKEN);

  /*
   * Both halves or neither. A URL without a token cannot authenticate and a
   * token without a URL has nowhere to go; treating either alone as "no
   * store" is what keeps a half-finished setup from looking like a working
   * one.
   */
  return url === null || token === null ? null : { kind: "upstash", url, token };
};
