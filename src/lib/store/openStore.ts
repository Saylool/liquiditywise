import "server-only";

import { chooseStore, type StoreEnvironment } from "./chooseStore";
import type { KeyValueStore } from "./keyValueStore";
import { nodeRedisConnect } from "./nodeRedisSocket";
import { createRedisClient } from "./redisClient";
import { createRedisKeyValueStore } from "./redisKeyValueStore";
import { createUpstashKeyValueStore } from "../telegram/upstashKeyValue";

/*
 * Opens whichever store this deployment named, or `null` when it named none.
 *
 * Nothing is connected until the store is used, so opening one to find out
 * whether there is one costs nothing. Shared by everything that keeps
 * something: the Telegram links, and the smart-money measurements.
 */
export const openStore = (environment: StoreEnvironment): KeyValueStore | null => {
  const choice = chooseStore(environment);
  if (choice === null) return null;

  return choice.kind === "redis"
    ? createRedisKeyValueStore(
        createRedisClient({
          connect: nodeRedisConnect(choice.address),
          password: choice.address.password,
          database: choice.address.database,
        }),
      )
    : createUpstashKeyValueStore({ url: choice.url, token: choice.token });
};

/** The store the process environment names. */
export const openConfiguredStore = (): KeyValueStore | null =>
  openStore({
    REDIS_URL: process.env.REDIS_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
