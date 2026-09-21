/*
 * Points the Telegram bot at one deployment's webhook.
 *
 *   node --env-file=.env.local scripts/setTelegramWebhook.mjs https://example.com
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment and
 * prints one word: whether Telegram accepted the webhook. It never prints either
 * value, and the URL it builds carries the token, so it is never printed either.
 */

const origin = process.argv[2];
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!origin || !/^https:\/\//.test(origin)) {
  console.error("usage: node --env-file=.env.local scripts/setTelegramWebhook.mjs https://<host>");
  process.exit(2);
}
if (!token || !secret) {
  console.error("TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must both be set");
  process.exit(2);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `${origin.replace(/\/+$/, "")}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
  }),
});

const payload = await response.json().catch(() => null);
const ok = response.ok && payload?.ok === true;
console.log(ok ? "webhook set" : `webhook not set (HTTP ${response.status}${payload?.description ? `: ${payload.description}` : ""})`);
process.exit(ok ? 0 : 1);
