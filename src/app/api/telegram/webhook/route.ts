import { NextResponse, type NextRequest } from "next/server";

import { getDictionary } from "@/lib/i18n/dictionaries";
import { telegramSetup } from "@/lib/telegram/environment";
import { handleUpdate } from "@/lib/telegram/handleUpdate";
import { sameSecret } from "@/lib/telegram/secrets";
import { TelegramUpdateSchema } from "@/lib/telegram/update";

/*
 * Where Telegram delivers the bot's messages.
 *
 * Telegram presents the secret it was given at `setWebhook` in a header, and
 * a request without it is answered 401 and otherwise ignored — the URL is
 * guessable, the secret is not. Everything else is answered 200 whatever
 * happened inside, because Telegram redelivers anything it did not get a 200
 * for, and a malformed update redelivered for ever helps nobody.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const setup = telegramSetup();
  if (setup === null) return NextResponse.json({ ok: false }, { status: 503 });

  if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token"), setup.webhookSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = TelegramUpdateSchema.safeParse(await request.json().catch(() => null));
  if (update.success) {
    await handleUpdate(update.data, { store: setup.store, bot: setup.bot, dictionary: getDictionary });
  }

  return NextResponse.json({ ok: true });
}
