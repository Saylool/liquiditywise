#!/usr/bin/env bash
# The daily backup of the Telegram links. Installed by setup.sh as
# /usr/local/bin/liquiditywise-backup and run by cron once a day, as root.
#
#   liquiditywise-backup                 take one now
#   liquiditywise-backup --if-set-up     the same, and nothing at all before
#                                        set-backup-token.sh has run (cron)
#   liquiditywise-backup --list          the backups Cloudflare holds
#   liquiditywise-backup --fetch DAY     one of them, still encrypted, to stdout
#
# The links are the one thing this application keeps about anybody, and until
# this they lived on one disk. Each day they are copied out of Redis, gzipped,
# encrypted to deploy/backup-recipient.pem, and stored in Workers KV, which
# deletes each copy seven days after it was written. That is the promise the
# site makes readers: a link removed with /stop is gone from this server at
# once and from the backups within seven days.
#
# Encrypted to a certificate whose private key is not on this machine. The
# server can write a backup and cannot read one, so a copy taken off
# Cloudflare, or off this server, is a copy nobody without that key can open.
#
# A backup that succeeded leaves the time in $STAMP_FILE. health-check.sh reads
# it, and one that is more than a day old is reported through Server Watch —
# so a backup that silently stopped is found the next morning, not the day it
# is needed.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"
RECIPIENT="${RECIPIENT:-$APP_DIR/deploy/backup-recipient.pem}"
STAMP_FILE="${STAMP_FILE:-/var/lib/liquiditywise/backup.last}"
API="${CLOUDFLARE_API:-https://api.cloudflare.com/client/v4}"
KEEP_SECONDS=$(( 7 * 24 * 60 * 60 ))
# What the copies are called. Only ever changed to prove a restore on made-up
# links without writing over a real day's backup.
NAME="${BACKUP_NAME_PREFIX:-backup}"

setting() {
  # `|| true`: a setting that is not there is an empty answer, not a reason
  # for set -e to end the script before it can say which one is missing.
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

TOKEN="$(setting CLOUDFLARE_BACKUP_TOKEN)"
ACCOUNT="$(setting CLOUDFLARE_ACCOUNT_ID)"
NAMESPACE="$(setting BACKUP_KV_NAMESPACE_ID)"
REDIS_URL="$(setting REDIS_URL)"

if [ -z "$TOKEN" ] || [ -z "$ACCOUNT" ] || [ -z "$NAMESPACE" ]; then
  [ "${1:-}" = "--if-set-up" ] && exit 0
  echo "Backups are not set up: run deploy/set-backup-token.sh." >&2
  exit 1
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/liquiditywise-backup.XXXXXX")"
trap 'rm -rf "$work"' EXIT
chmod 700 "$work"

# The token goes to curl in a file, not on its command line, where every
# user on this shared machine could read it in the process list.
printf 'Authorization: Bearer %s\n' "$TOKEN" > "$work/auth"
values="$API/accounts/$ACCOUNT/storage/kv/namespaces/$NAMESPACE/values"

if [ "${1:-}" = "--list" ]; then
  curl -sS --fail -m 30 -H @"$work/auth" \
    "$API/accounts/$ACCOUNT/storage/kv/namespaces/$NAMESPACE/keys?prefix=$NAME/" |
    python3 -c 'import json, sys
for key in json.load(sys.stdin)["result"]:
    print(key["name"])'
  exit 0
fi

if [ "${1:-}" = "--fetch" ]; then
  day="${2:?which day: YYYY-MM-DD}"
  printf '%s' "$day" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' || { echo "A day is YYYY-MM-DD." >&2; exit 1; }
  curl -sS --fail -m 60 -H @"$work/auth" "$values/$NAME%2F$day"
  exit 0
fi

[ -r "$RECIPIENT" ] || { echo "$RECIPIENT is not there." >&2; exit 1; }
[ -n "$REDIS_URL" ] || { echo "REDIS_URL is not set in $ENV_FILE." >&2; exit 1; }

REDIS_URL="$REDIS_URL" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  "$APP_DIR/deploy/store-backup.mts" export > "$work/snapshot.json"

# Read back the way a restore will read it, before anything is stored: a
# snapshot the restore would refuse is not a backup.
summary="$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  "$APP_DIR/deploy/store-backup.mts" describe < "$work/snapshot.json")"

gzip -9 -n < "$work/snapshot.json" |
  openssl cms -encrypt -binary -aes256 -outform DER -recip "$RECIPIENT" > "$work/backup"

# One key per day: a second run the same day replaces the first rather than
# adding to what is kept.
day="$(date -u +%Y-%m-%d)"
curl -sS --fail -m 60 -X PUT -H @"$work/auth" -H "Content-Type: application/octet-stream" \
  --data-binary @"$work/backup" "$values/$NAME%2F$day?expiration_ttl=$KEEP_SECONDS" > /dev/null

# Read back and compared, so the stamp below means "stored", not "sent".
curl -sS --fail -m 60 -H @"$work/auth" "$values/$NAME%2F$day" > "$work/stored"
if ! cmp -s "$work/backup" "$work/stored"; then
  echo "What Cloudflare holds for $day is not what was sent." >&2
  exit 1
fi

mkdir -p "$(dirname "$STAMP_FILE")"
date +%s > "$STAMP_FILE"
echo "Stored $NAME/$day, $summary, $(( $(wc -c < "$work/backup") )) bytes encrypted."
