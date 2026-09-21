import { z } from "zod";

/*
 * What Telegram sends to the webhook, read as narrowly as this bot needs.
 *
 * Non-strict, like every wire schema here: an Update carries dozens of
 * optional fields and Telegram adds more with every release. Only a text
 * message from a private chat means anything to this bot, and everything
 * else is acknowledged and ignored — an update the bot does not answer is
 * redelivered until it does.
 */

export const TelegramUpdateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      chat: z.object({ id: z.number().int(), type: z.string() }),
      from: z.object({ language_code: z.string().optional() }).optional(),
      text: z.string().optional(),
    })
    .optional(),
});

export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;

/** The commands this bot understands, and the one argument `start` carries. */
export type BotCommand =
  | { readonly kind: "start"; readonly argument: string | null }
  | { readonly kind: "stop" }
  | { readonly kind: "other" };

/**
 * Reads a command out of a message.
 *
 * `/start` may carry the deep-link token as its only argument; Telegram puts
 * the `start=` parameter there. A bot's own username may be suffixed to a
 * command in a group (`/stop@SomeBot`), which is allowed and stripped.
 */
export const readCommand = (text: string | undefined): BotCommand | null => {
  if (text === undefined) return null;

  const match = /^\/([a-z]+)(?:@\w+)?(?:\s+(\S+))?\s*$/i.exec(text.trim());
  if (match === null) return null;

  const [, name, argument] = match;
  switch (name?.toLowerCase()) {
    case "start":
      return { kind: "start", argument: argument ?? null };
    case "stop":
      return { kind: "stop" };
    default:
      return { kind: "other" };
  }
};
