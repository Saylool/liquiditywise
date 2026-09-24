#!/usr/bin/env bash
# The week's use of the site, sent through Server Watch. Installed by setup.sh
# as /usr/local/bin/liquiditywise-usage and run by cron on Monday mornings.
#
#   liquiditywise-usage            the last seven full days, to Telegram
#   liquiditywise-usage --print    the same, printed here instead
#
# Counted from the application's own journal: the visit lines the proxy writes
# and the spend lines the explanation writes (src/lib/usage/usageLines.ts says
# what is in them — pages, pools, languages and token counts, never who). The
# number of chats following an address comes from Redis.
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"

setting() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

# Seven whole days, UTC, ending with yesterday.
today="$(date -u +%F)"
from="$(date -u -d '7 days ago' +%F)"
to="$(date -u -d 'yesterday' +%F)"

# Chats following an address now. The password, if any, goes to redis-cli in
# its environment, never as an argument.
redis_url="$(setting REDIS_URL)"
redis_password=""
case "$redis_url" in redis://:*@*) redis_password="${redis_url#redis://:}"; redis_password="${redis_password%%@*}" ;; esac
database="${redis_url##*/}"; case "$database" in ''|*[!0-9]*) database=0 ;; esac
links="$(REDISCLI_AUTH="$redis_password" redis-cli -n "$database" SCARD liquiditywise:telegram:watches 2>/dev/null | tr -dc '0-9')"

message="$(journalctl -u liquiditywise --since "$from 00:00:00 UTC" --until "$today 00:00:00 UTC" \
    --no-pager -o short-iso --utc 2>/dev/null |
  TELEGRAM_LINKS="$links" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    "$APP_DIR/deploy/usage-report.mts" --from "$from" --to "$to")" || {
  echo "The report could not be made." >&2
  exit 1
}

if [ "${1:-}" = "--print" ]; then
  printf '%s\n' "$message"
  exit 0
fi

token="$(setting SERVER_WATCH_BOT_TOKEN)"
chat="$(setting TELEGRAM_OPERATOR_CHAT_ID)"
[ -n "$token" ] && [ -n "$chat" ] || { echo "SERVER_WATCH_BOT_TOKEN or TELEGRAM_OPERATOR_CHAT_ID is not set." >&2; exit 1; }

# The token goes to curl on standard input, never on its command line.
answer="$(printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
  curl -sS -m 20 -K - -X POST \
    --data-urlencode "chat_id=$chat" \
    --data-urlencode "text=$message" \
    --data-urlencode "disable_web_page_preview=true")"
if ! printf '%s' "$answer" | grep -q '"ok":true'; then
  echo "Telegram did not take the report." >&2
  exit 1
fi
echo "Sent the report for $from – $to."
