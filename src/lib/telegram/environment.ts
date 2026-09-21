import "server-only";

import { chooseStore } from "../store/chooseStore";
import type { KeyValueStore } from "../store/keyValueStore";
import { nodeRedisConnect } from "../store/nodeRedisSocket";
import { createRedisClient } from "../store/redisClient";
import { createRedisKeyValueStore } from "../store/redisKeyValueStore";
import { createBotClient, type BotClient } from "./botApi";
import { createUpstashKeyValueStore } from "./upstashKeyValue";

/*
 * What a deployment needs for Telegram alerts, read from the environment.
 *
 * Optional as a whole: with nothing configured the site says alerts are not
 * set up here and does nothing else differently. Read per call rather than
 * captured at module load, like every other setting, and named one by one so
 * a misspelled variable is a compile error rather than a feature that
 * silently never exists.
 */

export type TelegramEnvironment = {
  readonly TELEGRAM_BOT_TOKEN?: string | undefined;
  readonly TELEGRAM_BOT_USERNAME?: string | undefined;
  readonly TELEGRAM_WEBHOOK_SECRET?: string | undefined;
  readonly CRON_SECRET?: string | undefined;
  readonly REDIS_URL?: string | undefined;
  readonly UPSTASH_REDIS_REST_URL?: string | undefined;
  readonly UPSTASH_REDIS_REST_TOKEN?: string | undefined;
};

/** Opens whichever store this deployment named. Nothing is connected until used. */
const buildStore = (environment: TelegramEnvironment): KeyValueStore | null => {
  const choice = chooseStore(environment);
  if (choice === null) return null;

  return choice.kind === "redis"
    ? createRedisKeyValueStore(createRedisClient({
        connect: nodeRedisConnect(choice.address),
        password: choice.address.password,
        database: choice.address.database,
      }))
    : createUpstashKeyValueStore({ url: choice.url, token: choice.token });
};

export type TelegramSetup = {
  readonly store: KeyValueStore;
  readonly bot: BotClient;
  /** Without the `@`, as `t.me/<username>` wants it. */
  readonly username: string;
  readonly webhookSecret: string;
  readonly cronSecret: string;
};

const present = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
};

/** Every piece, or `null`: a half-configured setup must not look like a working one. */
export const telegramSetupFrom = (environment: TelegramEnvironment): TelegramSetup | null => {
  const token = present(environment.TELEGRAM_BOT_TOKEN);
  const username = present(environment.TELEGRAM_BOT_USERNAME)?.replace(/^@/, "") ?? null;
  const webhookSecret = present(environment.TELEGRAM_WEBHOOK_SECRET);
  const cronSecret = present(environment.CRON_SECRET);
  const store = buildStore(environment);

  if (!token || !username || !webhookSecret || !cronSecret || store === null) return null;

  return {
    store,
    bot: createBotClient({ token }),
    username,
    webhookSecret,
    cronSecret,
  };
};

export const telegramSetup = (): TelegramSetup | null =>
  telegramSetupFrom({
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
