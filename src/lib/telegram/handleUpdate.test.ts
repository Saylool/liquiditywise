import { describe, expect, it } from "vitest";

import { getDictionary } from "../i18n/dictionaries";
import type { BotClient } from "./botApi";
import { fakeStore } from "./fakeStore";
import { handleUpdate } from "./handleUpdate";
import { claimLink, createPendingLink, readLink } from "./links";
import type { TelegramUpdate } from "./update";

const TOKEN = "abcDEF123456789012_-xy";
const ADDRESS = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";

const fakeBot = () => {
  const sent: { chatId: number; text: string }[] = [];
  const bot: BotClient = {
    sendMessage: async (chatId, text) => {
      sent.push({ chatId, text });
      return true;
    },
  };
  return { bot, sent };
};

const message = (text: string, chatId = 42, language = "tr", type = "private"): TelegramUpdate => ({
  update_id: 1,
  message: { chat: { id: chatId, type }, from: { language_code: language }, text },
});

const setup = async () => {
  const store = fakeStore();
  await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "de", now: new Date() });
  const { bot, sent } = fakeBot();
  return { store, bot, sent, handling: { store, bot, dictionary: getDictionary } };
};

describe("handleUpdate", () => {
  it("claims the link on /start and answers in the language the site recorded", async () => {
    const { handling, sent, store } = await setup();
    await handleUpdate(message(`/start ${TOKEN}`), handling);

    expect((await readLink(store, TOKEN))?.chatId).toBe(42);
    expect(sent).toEqual([{ chatId: 42, text: getDictionary("de").telegram.linked(ADDRESS) }]);
  });

  it("answers an unknown token in the sender's own language", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message("/start zyxWVU987654321098_-ab", 42, "es"), handling);
    expect(sent).toEqual([{ chatId: 42, text: getDictionary("es").telegram.unknownStart }]);
  });

  it("refuses a token a different chat already claimed", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 7);
    await handleUpdate(message(`/start ${TOKEN}`, 42, "en"), handling);
    expect(sent).toEqual([{ chatId: 42, text: getDictionary("en").telegram.alreadyClaimed }]);
    expect((await readLink(store, TOKEN))?.chatId).toBe(7);
  });

  it("forgets the link on /stop, and says so in the link's language", async () => {
    const { handling, sent, store } = await setup();
    await claimLink(store, TOKEN, 42);
    await handleUpdate(message("/stop", 42, "en"), handling);

    expect(await readLink(store, TOKEN)).toBeNull();
    expect(sent).toEqual([{ chatId: 42, text: getDictionary("de").telegram.stopped }]);
  });

  it("tells a chat that follows nothing that there is nothing to stop", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message("/stop", 99, "hi"), handling);
    expect(sent).toEqual([{ chatId: 99, text: getDictionary("hi").telegram.nothingToStop }]);
  });

  it("answers anything else with the help line, and a bare /start too", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message("hello there", 42, "zh"), handling);
    await handleUpdate(message("/start", 42, "zh"), handling);
    await handleUpdate(message("/help", 42, "zh"), handling);
    expect(sent.map((item) => item.text)).toEqual(Array(3).fill(getDictionary("zh").telegram.help));
  });

  it("falls back to English for a language it does not publish", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message("hello", 42, "fi"), handling);
    expect(sent[0]?.text).toBe(getDictionary("en").telegram.help);
  });

  it("ignores anything that is not a private chat, and updates without a message", async () => {
    const { handling, sent } = await setup();
    await handleUpdate(message(`/start ${TOKEN}`, 42, "tr", "group"), handling);
    await handleUpdate({ update_id: 3 }, handling);
    expect(sent).toEqual([]);
  });

  it("says the store is down rather than that the link is unknown", async () => {
    const { handling, sent, store } = await setup();
    store.down = true;
    await handleUpdate(message(`/start ${TOKEN}`, 42, "en"), handling);
    await handleUpdate(message("/stop", 42, "en"), handling);
    expect(sent.map((item) => item.text)).toEqual(Array(2).fill(getDictionary("en").telegram.storeDown));
  });
});
