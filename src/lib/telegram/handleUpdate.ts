import type { Dictionary } from "../i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale, negotiateLocale } from "../i18n/locales";
import type { BotClient } from "./botApi";
import { claimLink, findByChat, forgetLink, setSmartAlerts } from "./links";
import { readCommand, type TelegramUpdate } from "./update";
import type { KeyValueStore } from "../store/keyValueStore";

/*
 * What the bot does with one message.
 *
 * Three commands and a shrug. `/start <token>` ties this chat to the link the
 * token names and says so in the language the reader was using on the site.
 * `/stop` forgets whatever this chat was tied to. `/smart` turns the
 * smart-money alerts on for the link, or off again: they are off until asked
 * for, because the link was made for a narrower promise. Anything else gets
 * the help line, in the language Telegram says the sender uses.
 *
 * Pure of the framework: the store and the bot are handed in, so a test can
 * watch what would have been sent without a network.
 */

export type UpdateHandling = {
  readonly store: KeyValueStore;
  readonly bot: BotClient;
  readonly dictionary: (locale: Locale) => Dictionary;
};

/** Telegram reports a sender's language as an IETF tag, which is what the negotiator reads. */
const senderLocale = (languageCode: string | undefined): Locale =>
  negotiateLocale(languageCode) ?? DEFAULT_LOCALE;

export const handleUpdate = async (
  update: TelegramUpdate,
  { store, bot, dictionary }: UpdateHandling,
): Promise<void> => {
  const message = update.message;
  if (message === undefined || message.chat.type !== "private") return;

  const chatId = message.chat.id;
  const fallback = dictionary(senderLocale(message.from?.language_code));
  const command = readCommand(message.text);

  if (command === null || command.kind === "other") {
    await bot.sendMessage(chatId, fallback.telegram.help);
    return;
  }

  if (command.kind === "stop") {
    const watch = await findByChat(store, chatId);
    if (watch === undefined) {
      await bot.sendMessage(chatId, fallback.telegram.storeDown);
      return;
    }
    if (watch === null) {
      await bot.sendMessage(chatId, fallback.telegram.nothingToStop);
      return;
    }

    await forgetLink(store, watch.token);
    await bot.sendMessage(chatId, dictionary(watch.link.locale).telegram.stopped);
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

  if (command.argument === null) {
    await bot.sendMessage(chatId, fallback.telegram.help);
    return;
  }

  const outcome = await claimLink(store, command.argument, chatId);
  switch (outcome) {
    case "claimed": {
      /* Read back for the language and the address the site recorded. */
      const watch = await findByChat(store, chatId);
      const t = watch === null || watch === undefined ? fallback : dictionary(watch.link.locale);
      await bot.sendMessage(chatId, t.telegram.linked(watch?.link.address ?? ""));
      return;
    }
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
