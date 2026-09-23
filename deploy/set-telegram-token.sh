#!/usr/bin/env bash
# Replaces the bot token in .env.local, restarts the application and points
# Telegram at this deployment again. Run as root:
#
#   bash /opt/liquiditywise/deploy/set-telegram-token.sh
#
# The token is typed at a prompt that does not echo it, goes straight into a
# file only root and the application user can read, and is never printed,
# logged or passed as an argument — an argument would sit in the shell's
# history and in every `ps` listing on the machine for as long as this runs.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_USER="${APP_USER:-liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"
ORIGIN="${ORIGIN:-https://liquiditywise.com}"

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is not there."; exit 1; }

printf 'Paste the token @BotFather gave you, then press Enter.\n'
printf 'It will not appear on screen: '
read -rs token
printf '\n'

# The shape BotFather issues: a numeric id, a colon, then the secret part.
if ! printf '%s' "$token" | grep -qE '^[0-9]{6,16}:[A-Za-z0-9_-]{30,}$'; then
  echo "That does not look like a bot token. Nothing was changed."
  exit 1
fi

# Ask Telegram who it is before writing anything, so a mistyped token is
# refused here rather than discovered by a reader whose alerts stopped.
who="$(curl -s -m 15 "https://api.telegram.org/bot$token/getMe")"
if ! printf '%s' "$who" | grep -q '"ok":true'; then
  echo "Telegram did not accept that token. Nothing was changed."
  exit 1
fi
echo "Telegram accepts it: @$(printf '%s' "$who" | grep -oE '"username":"[^"]+"' | head -1 | cut -d'"' -f4)"

# Rewritten with the value passed through the environment rather than the
# command line, for the same reason as above.
TOKEN="$token" python3 - "$ENV_FILE" <<'PY'
import os
import sys

path = sys.argv[1]
token = os.environ["TOKEN"]

with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines(keepends=True)

out, seen = [], False
for line in lines:
    if line.startswith("TELEGRAM_BOT_TOKEN="):
        out.append("TELEGRAM_BOT_TOKEN=" + token + "\n")
        seen = True
    else:
        out.append(line)

if not seen:
    out.append("\nTELEGRAM_BOT_TOKEN=" + token + "\n")

with open(path, "w", encoding="utf-8") as handle:
    handle.write("".join(out))
PY

chmod 600 "$ENV_FILE"
chown "$APP_USER:$APP_USER" "$ENV_FILE"
unset token

systemctl restart liquiditywise
sleep 3

cd "$APP_DIR"
sudo -u "$APP_USER" -H node --env-file=.env.local scripts/setTelegramWebhook.mjs "$ORIGIN"

secret="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
port="$(grep -oE 'Environment=PORT=[0-9]+' /etc/systemd/system/liquiditywise.service | cut -d= -f3)"
echo "check route: $(curl -s -H "Authorization: Bearer $secret" "http://127.0.0.1:$port/api/telegram/check")"
