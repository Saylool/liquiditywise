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
#
# The checkout belongs to the application user, so anything in it may have
# been put there by that user — including a symbolic link where .env.local
# should be, which the chmod below, run as root, would follow to whatever file
# it names. Refused rather than followed.
if [ -L "$APP_DIR/.env.local" ] || [ -L "$APP_DIR/.env.example" ]; then
  echo "$APP_DIR/.env.local or .env.example is a symbolic link; not touching it as root." >&2
  exit 1
fi
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

# The scheduled jobs: two every five minutes, the backup once a day, two
# weekly. All read their secrets from .env.local at run time, so the cron file
# stays world-readable and holds none.
#
# Who runs them. The checkout above belongs to the application user, and so
# does everything in it: the deploy scripts, the .mts files, the Python, every
# module they import. A root job that ran any of it would make that account —
# the one the internet-facing process runs as — a way to run code as root on a
# schedule. So two rules, held by src/deployScripts.test.ts:
#
#   - A job that needs nothing only root has runs as $APP_USER. The Telegram
#     check, the health check and the backup only read .env.local (which that
#     user owns, mode 600), talk to 127.0.0.1, Redis, Telegram and the backup
#     Worker, and keep their state in $STATE_DIR, which that user owns.
#   - A job that does need root runs a root-owned copy installed here, never a
#     file in the checkout, and that copy loads nothing from the checkout
#     while it is root. cloudflare-only.sh rewrites the nginx site and reloads
#     nginx, so it and its Python are copied to $LIB_DIR. The usage report
#     needs root for one thing, reading the system journal: it reads it as
#     root and hands it to the report's node code with the privileges dropped
#     to $APP_USER (usage-report.sh says how).
#
# The copies are made from the checkout at deploy time, by this script, which
# root runs by hand: the same trust as running the script at all, and no more.
# The scripts in /usr/local/bin were always root-owned copies; what changed is
# that none of them runs checkout code as root any longer.
LIB_DIR="/usr/local/lib/liquiditywise"
STATE_DIR="/var/lib/liquiditywise/state"
install -o root -g root -m 755 "$APP_DIR/deploy/telegram-check.sh" /usr/local/bin/liquiditywise-telegram-check
install -o root -g root -m 755 "$APP_DIR/deploy/health-check.sh" /usr/local/bin/liquiditywise-health
install -o root -g root -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/liquiditywise-backup
install -o root -g root -m 755 "$APP_DIR/deploy/usage-report.sh" /usr/local/bin/liquiditywise-usage
install -d -o root -g root -m 755 "$LIB_DIR"
install -o root -g root -m 755 "$APP_DIR/deploy/cloudflare-only.sh" "$LIB_DIR/cloudflare-only.sh"
install -o root -g root -m 644 "$APP_DIR/deploy/cloudflare_only.py" "$LIB_DIR/cloudflare_only.py"

# /var/lib/liquiditywise stays root's: nginx includes the Cloudflare allow
# list from it, and a directory the application user could write is one it
# could swap that list in. The jobs' own state goes one level down, in a
# directory of the application user's.
install -d -o root -g root -m 755 /var/lib/liquiditywise
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$STATE_DIR"
# Moved, once, from where root's jobs used to keep them. Handed over while
# still in root's directory and only then moved, so nothing is ever chowned
# inside the application user's, where it could have been swapped for a link
# to somebody else's file between one command and the next.
for name in health.state backup.last; do
  old="/var/lib/liquiditywise/$name"
  [ -f "$old" ] && [ ! -L "$old" ] || continue
  if [ -e "$STATE_DIR/$name" ] || [ -L "$STATE_DIR/$name" ]; then
    rm -f "$old"
  else
    chown "$APP_USER:$APP_USER" "$old"
    mv -T "$old" "$STATE_DIR/$name"
  fi
done

# The jobs' PATH: where node is, and the system's. Never anything in the
# checkout, where a `node` or a `curl` of the application user's would be
# found first.
JOB_PATH="$(dirname "$(command -v node)"):/usr/bin:/bin"
case "$JOB_PATH" in
  *"$APP_DIR"*) echo "node resolves inside $APP_DIR; not scheduling anything with that PATH." >&2; exit 1 ;;
esac
{
  echo "*/5 * * * * $APP_USER PATH=$JOB_PATH APP_PORT=$APP_PORT /usr/local/bin/liquiditywise-telegram-check"
  echo "*/5 * * * * $APP_USER PATH=$JOB_PATH APP_PORT=$APP_PORT DOMAIN=$DOMAIN /usr/local/bin/liquiditywise-health"
  # The week's use of the site, through Server Watch: Monday 06:00 UTC, 09:00 in Turkey.
  # Root for the journal only; the report itself runs as $APP_USER.
  echo "0 6 * * 1 root PATH=$JOB_PATH /usr/local/bin/liquiditywise-usage > /dev/null"
  # Cloudflare's address list, weekly: the site answers nothing else. With
  # /usr/sbin, where nginx is and cron's own PATH does not reach.
  echo "23 4 * * 1 root PATH=/usr/sbin:/usr/bin:/sbin:/bin /bin/bash $LIB_DIR/cloudflare-only.sh > /dev/null"
  # Off the five-minute marks, and quiet until set-backup-secret.sh has run.
  echo "17 3 * * * $APP_USER PATH=$JOB_PATH /usr/local/bin/liquiditywise-backup --if-set-up > /dev/null"
} > /etc/cron.d/liquiditywise
chmod 644 /etc/cron.d/liquiditywise

sleep 3
echo
echo "application on 127.0.0.1:$APP_PORT: HTTP $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/")"
systemctl --no-pager --lines=0 status liquiditywise | sed -n '1,3p'
echo "done"
