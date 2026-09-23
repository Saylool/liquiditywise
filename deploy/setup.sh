#!/usr/bin/env bash
# Sets up, or updates, LiquidityWise on one Ubuntu server. Run as root:
#
#   curl -fsSL https://raw.githubusercontent.com/Saylool/liquiditywise/main/deploy/setup.sh | bash
#
# or, once the repository is on the machine:
#
#   bash /opt/liquiditywise/deploy/setup.sh
#
# Idempotent: every step checks what is already there. The one thing it will
# not do is invent credentials — on the first run it stops after copying
# .env.example to .env.local and asks for the values to be filled in, and it
# never prints them.
set -euo pipefail

REPO="https://github.com/Saylool/liquiditywise.git"
APP_DIR="/opt/liquiditywise"
APP_USER="liquiditywise"
# The port the application listens on, loopback only. Pick one nothing else
# on this machine uses: `bash deploy/inspect.sh` lists what is taken.
APP_PORT="${APP_PORT:-3200}"
# Only the health check uses this, to find the certificate whose expiry it
# reports. Nothing here issues or edits one; deploy/nginx-site.sh does that.
DOMAIN="${DOMAIN:-liquiditywise.com}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl git ca-certificates gnupg

# Node 22 (LTS). Next.js 16 needs 20.9 or newer.
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

# No web server is installed or configured here. This machine serves other
# sites, and the proxy in front of this one is added by hand to whatever
# already owns ports 80 and 443 — see deploy/README.md.

# Redis, for the Telegram links. Ubuntu's own package binds 127.0.0.1 by
# default, which is where this wants it: the application reaches it over
# loopback and nothing else on the network can. If the machine already runs
# one — it may, for another site — this installs nothing and the existing one
# is used, which is why REDIS_URL names a database index and every key is
# prefixed.
if ! command -v redis-server >/dev/null; then
  apt-get install -y -q redis-server
fi
systemctl enable --quiet --now redis-server || true

# A user of its own, with no shell.
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

# The code, fetched *as the user that owns it*. Git refuses to work in a
# repository owned by somebody else — rightly, since a directory another
# account can write is a directory another account can put hooks in — and
# running as root here would mean either that refusal or an exception that
# waves it away. The directory belongs to the application user, so the clone
# and the fetch do too.
install -d -o "$APP_USER" -g "$APP_USER" -m 755 "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" -H git -C "$APP_DIR" fetch --quiet origin main
  sudo -u "$APP_USER" -H git -C "$APP_DIR" reset --quiet --hard origin/main
else
  sudo -u "$APP_USER" -H git clone --quiet "$REPO" "$APP_DIR"
fi

# The credentials: yours to write, never this script's.
if [ ! -f "$APP_DIR/.env.local" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env.local"
  chmod 600 "$APP_DIR/.env.local"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  echo
  echo "Fill in $APP_DIR/.env.local (nano $APP_DIR/.env.local), then run this script again."
  exit 0
fi
chmod 600 "$APP_DIR/.env.local"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Build as the application user.
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund && npm run build"

# Services.
sed "s/^Environment=PORT=.*/Environment=PORT=$APP_PORT/" "$APP_DIR/deploy/liquiditywise.service" > /etc/systemd/system/liquiditywise.service
chmod 644 /etc/systemd/system/liquiditywise.service
systemctl daemon-reload
systemctl enable --quiet liquiditywise
systemctl restart liquiditywise

# The scheduled jobs: two every five minutes, and the backup once a day. All
# read their secrets from .env.local at run time, so this file stays
# world-readable and holds none.
install -m 755 "$APP_DIR/deploy/telegram-check.sh" /usr/local/bin/liquiditywise-telegram-check
install -m 755 "$APP_DIR/deploy/health-check.sh" /usr/local/bin/liquiditywise-health
install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/liquiditywise-backup
install -d -m 755 /var/lib/liquiditywise
{
  echo "*/5 * * * * root APP_PORT=$APP_PORT /usr/local/bin/liquiditywise-telegram-check"
  echo "*/5 * * * * root APP_PORT=$APP_PORT DOMAIN=$DOMAIN /usr/local/bin/liquiditywise-health"
  # Off the five-minute marks, and quiet until set-backup-token.sh has run.
  echo "17 3 * * * root PATH=$(dirname "$(command -v node)"):/usr/bin:/bin /usr/local/bin/liquiditywise-backup --if-set-up > /dev/null"
} > /etc/cron.d/liquiditywise
chmod 644 /etc/cron.d/liquiditywise

sleep 3
echo
echo "application on 127.0.0.1:$APP_PORT: HTTP $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/")"
systemctl --no-pager --lines=0 status liquiditywise | sed -n '1,3p'
echo "done"
