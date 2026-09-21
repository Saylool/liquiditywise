#!/usr/bin/env bash
# Sets up, or updates, LiquidityWise on one Ubuntu server. Run as root:
#
#   curl -fsSL https://raw.githubusercontent.com/Saylool/uniswapadvisor/main/deploy/setup.sh | bash
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

REPO="https://github.com/Saylool/uniswapadvisor.git"
APP_DIR="/opt/liquiditywise"
APP_USER="liquiditywise"
# The port the application listens on, loopback only. Pick one nothing else
# on this machine uses: `bash deploy/inspect.sh` lists what is taken.
APP_PORT="${APP_PORT:-3200}"

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

# A user of its own, with no shell.
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

# The code: clone the first time, fast-forward after.
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin main
  git -C "$APP_DIR" reset --quiet --hard origin/main
else
  git clone --quiet "$REPO" "$APP_DIR"
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

# The Telegram check, every five minutes. The secret stays in .env.local.
install -m 755 "$APP_DIR/deploy/telegram-check.sh" /usr/local/bin/liquiditywise-telegram-check
echo "*/5 * * * * root APP_PORT=$APP_PORT /usr/local/bin/liquiditywise-telegram-check" > /etc/cron.d/liquiditywise
chmod 644 /etc/cron.d/liquiditywise

sleep 3
echo
echo "application on 127.0.0.1:$APP_PORT: HTTP $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/")"
systemctl --no-pager --lines=0 status liquiditywise | sed -n '1,3p'
echo "done"
