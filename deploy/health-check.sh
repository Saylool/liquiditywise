#!/usr/bin/env bash
# Tells the operator, through the bot the site already uses, when something
# has broken and will stay broken.
#
# It runs beside the application rather than inside it, because a process
# cannot report that it has stopped. What it can see from out here — whether
# the site answers, how long the certificate has left, how full the disk is —
# it measures and hands to /api/health, which knows the thresholds and the
# wording and can also see the things only the application can. What comes
# back is a list of faults, each with a stable id.
#
# Only changes are sent. A fault whose id was reported last time is not
# reported again, and an id that has gone produces one line saying so. An
# outage that lasts a week is two messages, not two thousand.
#
# What this cannot do is tell you the machine is off. Nothing that runs on a
# machine can. If that matters, point an outside uptime service at the site
# as well; this covers everything short of it.
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_PORT="${APP_PORT:-3200}"
DOMAIN="${DOMAIN:-liquiditywise.com}"
STATE_FILE="${STATE_FILE:-/var/lib/liquiditywise/health.state}"

# Values out of .env.local, never printed, never passed as an argument.
setting() {
  grep -E "^$1=" "$APP_DIR/.env.local" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

CRON_SECRET="$(setting CRON_SECRET)"
BOT_TOKEN="$(setting TELEGRAM_BOT_TOKEN)"
CHAT_ID="$(setting TELEGRAM_OPERATOR_CHAT_ID)"

if [ -z "$CHAT_ID" ] || [ -z "$BOT_TOKEN" ]; then
  echo "health check: TELEGRAM_OPERATOR_CHAT_ID or TELEGRAM_BOT_TOKEN missing from $APP_DIR/.env.local"
  exit 1
fi

# Telegram's own reply is discarded; a bot that cannot be reached is a fault
# this script has no way to report and no business retrying.
tell() {
  curl -sS -o /dev/null --max-time 20 \
    -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    --data-urlencode "chat_id=$CHAT_ID" \
    --data-urlencode "text=$1" \
    --data-urlencode "disable_web_page_preview=true" >/dev/null
}

# One message, to prove the operator chat is reachable before anything breaks.
if [ "${1:-}" = "--hello" ]; then
  tell "LiquidityWise health check installed on $(hostname). This is where outages will arrive."
  echo "sent"
  exit 0
fi

# --- readings only this side can take -----------------------------------

query=""

cert="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -r "$cert" ]; then
  end="$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)"
  if [ -n "$end" ]; then
    end_epoch="$(date -d "$end" +%s 2>/dev/null)"
    # An unreadable date sends nothing: a reading that was not taken has to
    # stay untaken, or the application would judge a number this made up.
    [ -n "$end_epoch" ] && query="certificateDays=$(( (end_epoch - $(date +%s)) / 86400 ))"
  fi
fi

disk="$(df -P "$APP_DIR" 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')"
if [ -n "$disk" ]; then
  query="${query:+$query&}diskPercent=$disk"
fi

# --- ask the application ------------------------------------------------

body="$(curl -sS --max-time 30 -w '\n%{http_code}' \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:$APP_PORT/api/health${query:+?$query}" 2>/dev/null)"
status="$(printf '%s' "$body" | tail -1)"
json="$(printf '%s' "$body" | sed '$d')"

current=""
if [ "$status" = "200" ]; then
  # node is here because the application is; it parses its own JSON rather
  # than this script guessing at it with a regular expression.
  current="$(printf '%s' "$json" | node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      const problems = JSON.parse(raw).problems ?? [];
      for (const { id, message } of problems) process.stdout.write(`${id}\t${message}\n`);
    });
  ' 2>/dev/null)"
else
  # The one sentence that has to live out here, because the place that words
  # every other one is the place that is not answering.
  current="site-unreachable	liquiditywise.com is not answering on port $APP_PORT (HTTP ${status:-none}). Check \`systemctl status liquiditywise\` and \`journalctl -u liquiditywise -n 50\`."
fi

# --- send what has changed ----------------------------------------------

mkdir -p "$(dirname "$STATE_FILE")"
touch "$STATE_FILE"
previous="$(cat "$STATE_FILE")"

now_ids="$(printf '%s' "$current" | cut -f1 | grep -v '^$' | sort)"
old_ids="$(printf '%s' "$previous" | grep -v '^$' | sort)"

# A site that is not answering has not told us its other faults are over; it
# has told us nothing at all. So when it is down, everything reported last
# time is carried forward — otherwise a crash would be followed by a cheerful
# line saying the disk is no longer full, on no evidence whatever.
if [ "$status" != "200" ]; then
  now_ids="$(printf '%s\n%s' "$now_ids" "$old_ids" | grep -v '^$' | sort -u)"
fi

while IFS= read -r id; do
  [ -n "$id" ] || continue
  message="$(printf '%s\n' "$current" | grep -m1 -F "$id	" | cut -f2-)"
  tell "⚠️ $message"
done <<< "$(comm -23 <(printf '%s\n' "$now_ids") <(printf '%s\n' "$old_ids"))"

while IFS= read -r id; do
  [ -n "$id" ] || continue
  tell "✅ Recovered: $id"
done <<< "$(comm -13 <(printf '%s\n' "$now_ids") <(printf '%s\n' "$old_ids"))"

# Written last, so a run that dies while sending reports the same fault again
# rather than swallowing it.
printf '%s\n' "$now_ids" | grep -v '^$' > "$STATE_FILE"
