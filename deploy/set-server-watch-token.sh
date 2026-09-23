#!/usr/bin/env bash
# Stores the token of Server Watch — the bot that tells the operator when the
# sites on this server stop answering — and gives the bot its description.
# Run as root:
#
#   bash /opt/liquiditywise/deploy/set-server-watch-token.sh
#
# A bot of its own, apart from @LiquidityWiseBot, for one reason above the
# others: the product bot can message every reader who linked a chat, and a
# monitor that only ever says "a site is down" has no business holding that.
# The outside check on Cloudflare keeps a copy of whichever token it is given,
# and this way the one it keeps can do nothing but report.
#
# The token is typed at a prompt that does not echo it, goes straight into a
# file only root and the application user can read, and is never printed,
# logged or passed as an argument.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_USER="${APP_USER:-liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is not there."; exit 1; }

setting() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

CHAT_ID="$(setting TELEGRAM_OPERATOR_CHAT_ID)"
PRODUCT_BOT="$(setting TELEGRAM_BOT_USERNAME | sed 's/^@//')"
[ -n "$CHAT_ID" ] || { echo "TELEGRAM_OPERATOR_CHAT_ID is not set in $ENV_FILE."; exit 1; }

printf 'Paste the token @BotFather gave you for Server Watch, then press Enter.\n'
printf 'It will not appear on screen: '
# A token piped in from the clipboard has no newline after it, and `read` then
# reports failure even though it read the token — which `set -e` would turn
# into a silent exit. Whatever arrived is checked below either way.
token=""
IFS= read -rs token || true
printf '\n'
token="$(printf '%s' "$token" | tr -d '[:space:]')"

if ! printf '%s' "$token" | grep -qE '^[0-9]{6,16}:[A-Za-z0-9_-]{30,}$'; then
  echo "That does not look like a bot token. Nothing was changed."
  exit 1
fi

who="$(curl -s -m 15 "https://api.telegram.org/bot$token/getMe")"
if ! printf '%s' "$who" | grep -q '"ok":true'; then
  echo "Telegram did not accept that token. Nothing was changed."
  exit 1
fi
username="$(printf '%s' "$who" | grep -oE '"username":"[^"]+"' | head -1 | cut -d'"' -f4)"

# The whole point of a second bot is that it is not the first one. Pasting the
# product bot's token here would look like it worked and undo the separation.
if [ -n "$PRODUCT_BOT" ] && [ "$username" = "$PRODUCT_BOT" ]; then
  echo "That is @$PRODUCT_BOT's token, the product bot. Server Watch needs its own. Nothing was changed."
  exit 1
fi
echo "Telegram accepts it: @$username"

# A bot cannot start a conversation: the person has to press Start first. So
# a first message is sent now, and a refusal is caught here — rather than on
# the night the server goes down and the warning has nowhere to go.
sent="$(curl -s -m 15 -X POST "https://api.telegram.org/bot$token/sendMessage" \
  --data-urlencode "chat_id=$CHAT_ID" \
  --data-urlencode "text=Server Watch is connected. This is where you will hear when a site on the server stops answering, or the server itself does." )"
if ! printf '%s' "$sent" | grep -q '"ok":true'; then
  echo "Telegram would not deliver to your chat yet. Open @$username in Telegram, press Start, then run this again. Nothing was changed."
  exit 1
fi
echo "A first message is on its way to your chat."

# What the bot says about itself, before and after Start.
curl -s -m 15 -o /dev/null -X POST "https://api.telegram.org/bot$token/setMyShortDescription" \
  --data-urlencode "short_description=Tells you when a site on the server, or the server itself, stops answering."
curl -s -m 15 -o /dev/null -X POST "https://api.telegram.org/bot$token/setMyDescription" \
  --data-urlencode "description=Server Watch keeps an eye on the sites on this server — from the server itself, and from Cloudflare, where it still works when the machine is off. It only writes when something changes: when a site stops answering, and when it comes back. It does nothing else, and it has nothing to say to anyone but its operator."

TOKEN="$token" python3 - "$ENV_FILE" <<'PY'
import os
import sys

path = sys.argv[1]
token = os.environ["TOKEN"]

with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines(keepends=True)

out, seen = [], False
for line in lines:
    if line.startswith("SERVER_WATCH_BOT_TOKEN="):
        out.append("SERVER_WATCH_BOT_TOKEN=" + token + "\n")
        seen = True
    else:
        out.append(line)

if not seen:
    out.append("\nSERVER_WATCH_BOT_TOKEN=" + token + "\n")

with open(path, "w", encoding="utf-8") as handle:
    handle.write("".join(out))
PY

chmod 600 "$ENV_FILE"
chown "$APP_USER:$APP_USER" "$ENV_FILE"
unset token

# Nothing to restart: the application does not use this bot. The health check
# reads the token each time it runs.
echo "Stored as SERVER_WATCH_BOT_TOKEN."
