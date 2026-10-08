#!/usr/bin/env bash
# The week's use of the site, sent through Server Watch. Installed by setup.sh
# as /usr/local/bin/liquiditywise-usage and run by cron on Monday mornings.
#
#   liquiditywise-usage                    the last seven full days, to Telegram
#   liquiditywise-usage --print            the same, printed here instead
#   liquiditywise-usage --so-far [--print] the seven days up to this moment
#
# Counted from the application's own journal: the visit lines the proxy writes
# and the spend lines the explanation writes (src/lib/usage/usageLines.ts says
# what is in them — pages, pools, languages and token counts, never who). The
# number of chats following an address, and of addresses confirmed for the
# Monday digest by e-mail, come from Redis — as counts of two sets, never as
# their members.
#
# Root for one thing only. The application's journal lines are in the system
# journal, which only root (and the adm and systemd-journal groups, which see
# every other site's logs too) can read. Everything else — redis-cli, the
# report's node code, the message to Telegram — needs nothing root has, and
# the node code is usage-report.mts in the checkout, which the application
# user can write. So cron starts this as root, and as root it does nothing but
# read the journal and hand it, on standard input, to a second run of this
# same root-owned script with the privileges dropped to the application user.
# That run does the rest. Nothing from the checkout is ever run as root
# (setup.sh says why that matters).
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_USER="${APP_USER:-liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"

setting() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

print=0; so_far=0; journal_on_stdin=0
for flag in "$@"; do
  case "$flag" in
    --print) print=1 ;;
    --so-far) so_far=1 ;;
    # Only ever passed by the root half below, to the unprivileged half.
    --journal-on-stdin) journal_on_stdin=1 ;;
    *) echo "unknown option $flag" >&2; exit 1 ;;
  esac
done

# Seven whole days, UTC, ending with yesterday — or, asked mid-week, the seven
# days ending now. The unprivileged half is handed the days the root half
# read, so a run that straddles midnight cannot count one range and label
# another.
today="$(date -u +%F)"
if [ "$journal_on_stdin" = 1 ]; then
  from="${USAGE_FROM:?}"; to="${USAGE_TO:?}"
elif [ "$so_far" = 1 ]; then
  from="$(date -u -d '6 days ago' +%F)"; to="$today"; until="now"
else
  from="$(date -u -d '7 days ago' +%F)"; to="$(date -u -d 'yesterday' +%F)"; until="$today 00:00:00 UTC"
fi

journal() {
  journalctl -u liquiditywise --since "$from 00:00:00 UTC" --until "$until" \
    --no-pager -o short-iso --utc 2>/dev/null
}

if [ "$(id -u)" = 0 ]; then
  [ "$journal_on_stdin" = 0 ] || { echo "--journal-on-stdin is not for root." >&2; exit 1; }
  self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  cd "$APP_DIR" || exit 1
  journal |
    USAGE_FROM="$from" USAGE_TO="$to" \
    setpriv --reuid="$(id -u "$APP_USER")" --regid="$(id -g "$APP_USER")" --init-groups -- \
    /bin/bash "$self" --journal-on-stdin "$@"
  # The report's answer, not the journal's: an empty week is still a report.
  exit "${PIPESTATUS[1]}"
fi
# Not root, and not handed a journal: read it directly, which works for an
# account in the adm group and shows an empty week to any other.
[ "$journal_on_stdin" = 1 ] && journal() { cat; }

# Chats following an address now. The password, if any, goes to redis-cli in
# its environment, never as an argument.
redis_url="$(setting REDIS_URL)"
redis_password=""
case "$redis_url" in redis://:*@*) redis_password="${redis_url#redis://:}"; redis_password="${redis_password%%@*}" ;; esac
database="${redis_url##*/}"; case "$database" in ''|*[!0-9]*) database=0 ;; esac
links="$(REDISCLI_AUTH="$redis_password" redis-cli -n "$database" SCARD liquiditywise:telegram:watches 2>/dev/null | tr -dc '0-9')"
subscribers="$(REDISCLI_AUTH="$redis_password" redis-cli -n "$database" SCARD liquiditywise:email:confirmed 2>/dev/null | tr -dc '0-9')"

message="$(journal |
  TELEGRAM_LINKS="$links" EMAIL_SUBSCRIBERS="$subscribers" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    "$APP_DIR/deploy/usage-report.mts" --from "$from" --to "$to")" || {
  echo "The report could not be made." >&2
  exit 1
}

if [ "$print" = 1 ]; then
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
