import type { Dictionary } from "../i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale, negotiateLocale } from "../i18n/locales";
import type { BotClient } from "./botApi";
import { claimLink, findByChat, forgetChatLink, readLink, setSmartAlerts, setWeeklyDigest } from "./links";
import { poolWatchedText, poolWatchesText } from "./messages";
import { parsePoolWatch, type PoolWatchParse, type PoolWatchTarget } from "./poolWatchCommand";
import type { PoolRangeReading } from "./poolRangeShift";
import { addPoolWatch, forgetPoolWatches, MAX_POOL_WATCHES, readPoolWatches, removePoolWatch } from "./poolWatches";
import { readCommand, type TelegramUpdate } from "./update";
import type { KeyValueStore } from "../store/keyValueStore";
import { CHAINS } from "../chains/chains";
import { createFixedWindowRateLimiter, type RateLimiter } from "../ratelimit/fixedWindowLimiter";
import { formatWhole } from "../format/displayFormats";

/*
 * What the bot does with one message.
 *
 * Seven commands and a shrug. `/start <token>` ties this chat to the link the
 * token names and says so in the language the reader was using on the site.
 * `/stop` forgets whatever this chat was tied to — the link and the pool
 * watches both. `/smart` turns the smart-money alerts on for the link, or off
 * again: they are off until asked for, because the link was made for a
 * narrower promise. `/weekly` does the same for the Monday digest of where
 * the smart money moved. `/watch <pool>` follows one pool's suggested range
 * with no link at all, `/unwatch <pool>` stops, and `/watches` lists them.
 * Anything else gets the help line, in the language Telegram says the sender
 * uses.
 *
 * **The digest belongs to the link, as /smart does, though it is only
 * about public measurements.** A chat that has no link could in principle be
 * sent one, but keeping a second kind of record for it would be a second
 * thing `/stop` has to find and delete for the sake of one timestamp. Kept
 * on the link, the digest goes when the link goes, and it is sent in the
 * language and for the chain the link was made in.
 *
 * **The pool watches are that second kind of record (poolWatches.ts), and
 * they earn it.** A reader who holds no position has nothing to link, and the
 * thing they follow — a pool's suggested range — is nobody's address. So a
 * watch is keyed by the chat, speaks the language the chat wrote `/watch`
 * in, and is the other thing `/stop` deletes.
 *
 * **Each chat has a budget of commands**, `CHAT_COMMANDS_PER_WINDOW` in
 * `CHAT_COMMAND_WINDOW_MS`, and past it the bot says nothing and does
 * nothing: a `/watch` is a pool read and `/watches` up to five, and a chat
 * sending them in a loop would otherwise be a way to make the site read pools
 * as fast as Telegram delivers messages. Silence rather than a refusal,
 * because a refusal is a message too. Counted in this process's memory and
 * nowhere else, so the count writes no chat's id to the store; the webhook is
 * answered by the one process the site runs in.
 *
 * Pure of the framework: the store, the bot and the pool reader are handed
 * in, so a test can watch what would have been sent without a network.
 */

/** Commands one chat may send in a window. More than a reader setting up and checking a few pools ever needs. */
export const CHAT_COMMANDS_PER_WINDOW = 20;

/** Ten minutes. */
export const CHAT_COMMAND_WINDOW_MS = 10 * 60_000;

/** The process's own count; a flood of distinct chats evicts the oldest windows, as the pool pages' does. */
const chatCommandLimiter = createFixedWindowRateLimiter({
  limit: CHAT_COMMANDS_PER_WINDOW,
  windowMs: CHAT_COMMAND_WINDOW_MS,
  maxTrackedKeys: 10_000,
  now: () => Date.now(),
});

export type UpdateHandling = {
  readonly store: KeyValueStore;
  readonly bot: BotClient;
  readonly dictionary: (locale: Locale) => Dictionary;
  /** One pool's suggested range now, through the pages' own cached reader; `null` when it could not be read. */
  readonly readPoolRange: (target: PoolWatchTarget) => Promise<PoolRangeReading | null>;
  /** The time, handed in so a test can say when a range was told. */
  readonly now: () => Date;
  /** Each chat's budget of commands. The default is this process's own; a test hands in its own. */
  readonly chatBudget?: RateLimiter;
};

/** Telegram reports a sender's language as an IETF tag, which is what the negotiator reads. */
const senderLocale = (languageCode: string | undefined): Locale =>
  negotiateLocale(languageCode) ?? DEFAULT_LOCALE;

/** A pool read that threw is a pool that could not be read; nothing a reader does reaches the chat as an error. */
const quietly = async <T>(read: () => Promise<T>): Promise<T | null> => {
  try {
    return await read();
  } catch {
    return null;
  }
};

/** Which words `/watch` was missing, for a parse that was refused. */
const watchProblem = (parsed: Exclude<PoolWatchParse, { ok: true }>, t: Dictionary): string => {
  switch (parsed.reason) {
    case "no-pool":
    case "bad-pool":
      return t.telegram.watchHow;
    case "unknown-chain":
      return t.telegram.watchUnknownChain(parsed.word, CHAINS.map(({ slug }) => slug).join(", "));
    case "not-on-chain":
      return t.telegram.watchNotOnChain(`Uniswap ${parsed.protocol}`, parsed.chain.name);
  }
};

export const handleUpdate = async (
  update: TelegramUpdate,
  { store, bot, dictionary, readPoolRange, now, chatBudget = chatCommandLimiter }: UpdateHandling,
): Promise<void> => {
  const message = update.message;
  if (message === undefined || message.chat.type !== "private") return;

  const chatId = message.chat.id;
  if (!chatBudget.check(String(chatId)).allowed) return;
  const locale = senderLocale(message.from?.language_code);
  const fallback = dictionary(locale);
  const command = readCommand(message.text);

  if (command === null || command.kind === "other") {
    await bot.sendMessage(chatId, fallback.telegram.help);
    return;
  }

  if (command.kind === "stop") {
    const watch = await findByChat(store, chatId);
    const pools = await readPoolWatches(store, chatId);
    if (watch === undefined || pools === undefined) {
      await bot.sendMessage(chatId, fallback.telegram.storeDown);
      return;
    }
    if (watch === null && pools === null) {
      await bot.sendMessage(chatId, fallback.telegram.nothingToStop);
      return;
    }

    /* Both kinds of record, whichever the chat had: one command, and nothing left behind. */
    if (watch !== null) await forgetChatLink(store, chatId, watch.token);
    if (pools !== null) await forgetPoolWatches(store, chatId);
    await bot.sendMessage(chatId, dictionary(watch?.link.locale ?? pools?.locale ?? locale).telegram.stopped);
    return;
  }

  if (command.kind === "smart") {
    const watch = await findByChat(store, chatId);
    if (watch === undefined) {
      await bot.sendMessage(chatId, fallback.telegram.storeDown);
      return;
    }
    if (watch === null) {
      await bot.sendMessage(chatId, fallback.telegram.smartNoLink);
      return;
    }

    /* Turned on by the first ask, and off by the next: the same command, so there is one thing to remember. */
    const turningOn = watch.link.smart === undefined;
    const t = dictionary(watch.link.locale);
    if (!(await setSmartAlerts(store, watch.token, watch.link, turningOn))) {
      await bot.sendMessage(chatId, t.telegram.storeDown);
      return;
    }
    await bot.sendMessage(chatId, turningOn ? t.telegram.smartOn : t.telegram.smartOff);
    return;
  }

  if (command.kind === "weekly") {
    const watch = await findByChat(store, chatId);
    if (watch === undefined) {
      await bot.sendMessage(chatId, fallback.telegram.storeDown);
      return;
    }
    if (watch === null) {
      await bot.sendMessage(chatId, fallback.telegram.smartNoLink);
      return;
    }

    /* The same toggle as /smart: one command to remember, and off deletes the one time kept for it. */
    const turningOn = watch.link.weekly === undefined;
    const t = dictionary(watch.link.locale);
    if (!(await setWeeklyDigest(store, watch.token, watch.link, turningOn))) {
      await bot.sendMessage(chatId, t.telegram.storeDown);
      return;
    }
    await bot.sendMessage(chatId, turningOn ? t.telegram.weeklyOn : t.telegram.weeklyOff);
    return;
  }

  if (command.kind === "watch") {
    const parsed = parsePoolWatch(command.argument);
    if (!parsed.ok) {
      await bot.sendMessage(chatId, watchProblem(parsed, fallback));
      return;
    }

    /*
     * Read before anything is kept: the answer is the range, and a pool that
     * cannot be read now has no range to be the baseline. Nothing is written
     * for a pool that was never read, so a mistyped address leaves no record.
     */
    const reading = await quietly(() => readPoolRange(parsed.target));
    if (reading === null) {
      await bot.sendMessage(chatId, fallback.telegram.watchUnreadable);
      return;
    }

    const outcome = await addPoolWatch(store, chatId, { target: parsed.target, range: reading.range, locale, now: now() });
    switch (outcome) {
      case "added":
        await bot.sendMessage(chatId, poolWatchedText(reading, fallback, locale));
        return;
      case "full":
        await bot.sendMessage(chatId, fallback.telegram.watchFull(formatWhole(MAX_POOL_WATCHES, locale)));
        return;
      case "crowded":
        await bot.sendMessage(chatId, fallback.telegram.crowded);
        return;
      case "unavailable":
        await bot.sendMessage(chatId, fallback.telegram.storeDown);
        return;
    }
  }

  if (command.kind === "unwatch") {
    const parsed = parsePoolWatch(command.argument);
    if (!parsed.ok) {
      await bot.sendMessage(chatId, watchProblem(parsed, fallback));
      return;
    }

    const outcome = await removePoolWatch(store, chatId, parsed.target);
    switch (outcome) {
      case "removed":
        await bot.sendMessage(chatId, fallback.telegram.unwatched);
        return;
      case "not-watched":
        await bot.sendMessage(chatId, fallback.telegram.notWatched);
        return;
      case "unavailable":
        await bot.sendMessage(chatId, fallback.telegram.storeDown);
        return;
    }
  }

  if (command.kind === "watches") {
    const pools = await readPoolWatches(store, chatId);
    if (pools === undefined) {
      await bot.sendMessage(chatId, fallback.telegram.storeDown);
      return;
    }

    /* Named from a fresh read where one can be made — a few cached reads at most — and by their id where not. */
    const named = [];
    for (const watch of pools?.watches ?? []) {
      named.push({ watch, reading: await quietly(() => readPoolRange({ protocol: watch.protocol, chainId: watch.chainId, poolId: watch.poolId })) });
    }
    const t = pools === null ? fallback : dictionary(pools.locale);
    await bot.sendMessage(chatId, poolWatchesText(named, t, pools?.locale ?? locale));
    return;
  }

  if (command.argument === null) {
    await bot.sendMessage(chatId, fallback.telegram.help);
    return;
  }

  const outcome = await claimLink(store, command.argument, chatId);
  switch (outcome) {
    case "claimed": {
      /* Read back for the language and the address the site recorded. */
      const link = await readLink(store, command.argument);
      const t = link === null || link === undefined ? fallback : dictionary(link.locale);
      await bot.sendMessage(chatId, t.telegram.linked(link?.address ?? ""));
      return;
    }
    case "crowded":
      await bot.sendMessage(chatId, fallback.telegram.crowded);
      return;
    case "unknown":
      await bot.sendMessage(chatId, fallback.telegram.unknownStart);
      return;
    case "already-claimed":
      await bot.sendMessage(chatId, fallback.telegram.alreadyClaimed);
      return;
    case "unavailable":
      await bot.sendMessage(chatId, fallback.telegram.storeDown);
      return;
  }
};
