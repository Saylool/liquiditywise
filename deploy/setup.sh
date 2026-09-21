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

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

# Node 22 (LTS). Next.js 16 needs 20.9 or newer.
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

# Caddy, from its own repository.
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

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
install -m 644 "$APP_DIR/deploy/liquiditywise.service" /etc/systemd/system/liquiditywise.service
install -m 644 "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --quiet liquiditywise
systemctl restart liquiditywise
systemctl enable --quiet caddy
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy || systemctl restart caddy

# The Telegram check, every five minutes. The secret stays in .env.local.
install -m 755 "$APP_DIR/deploy/telegram-check.sh" /usr/local/bin/liquiditywise-telegram-check
echo "*/5 * * * * root /usr/local/bin/liquiditywise-telegram-check" > /etc/cron.d/liquiditywise
chmod 644 /etc/cron.d/liquiditywise

sleep 3
echo
echo "application: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
systemctl --no-pager --lines=0 status liquiditywise | sed -n '1,3p'
systemctl --no-pager --lines=0 status caddy | sed -n '1,3p'
echo "done"
