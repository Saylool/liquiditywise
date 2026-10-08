#!/usr/bin/env bash
# Runs one pass of the Telegram alert check against the local application.
#
# The bearer secret is read from .env.local at run time rather than written
# into the crontab, so the cron file can be world-readable and the secret is
# in one place. Silent on success; a failure prints the HTTP status to the
# cron log, and nothing else.
#
# Cron runs it as the application user: it needs nothing root has (setup.sh
# says why that matters). Started as root by hand, it starts itself again as
# that user rather than run as root.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_USER="${APP_USER:-liquiditywise}"
APP_PORT="${APP_PORT:-3200}"

# From the checkout, which that user can always enter, whatever directory it
# was started in: node, for one, will not start in a directory it cannot read.
self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
cd "$APP_DIR"
if [ "$(id -u)" = 0 ]; then
  exec setpriv --reuid="$(id -u "$APP_USER")" --regid="$(id -g "$APP_USER")" --init-groups -- /bin/bash "$self" "$@"
fi

secret="$(grep -E '^CRON_SECRET=' "$APP_DIR/.env.local" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
[ -n "$secret" ] || { echo "CRON_SECRET is not set in $APP_DIR/.env.local"; exit 1; }

# The secret goes to curl on standard input, not on the command line, where
# every account on this shared machine could read it in the process list.
status="$(printf 'header = "Authorization: Bearer %s"\n' "$secret" |
  curl -sS -o /dev/null -w '%{http_code}' -K - "http://127.0.0.1:$APP_PORT/api/telegram/check")"
[ "$status" = "200" ] || echo "telegram check answered HTTP $status"
