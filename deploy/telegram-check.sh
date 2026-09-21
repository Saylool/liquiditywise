#!/usr/bin/env bash
# Runs one pass of the Telegram alert check against the local application.
#
# The bearer secret is read from .env.local at run time rather than written
# into the crontab, so the cron file can be world-readable and the secret is
# in one place. Silent on success; a failure prints the HTTP status to the
# cron log, and nothing else.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_PORT="${APP_PORT:-3200}"
secret="$(grep -E '^CRON_SECRET=' "$APP_DIR/.env.local" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
[ -n "$secret" ] || { echo "CRON_SECRET is not set in $APP_DIR/.env.local"; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $secret" "http://127.0.0.1:$APP_PORT/api/telegram/check")"
[ "$status" = "200" ] || echo "telegram check answered HTTP $status"
