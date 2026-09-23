#!/usr/bin/env bash
# Makes the secret the daily backup is sent with, and where it is sent. Run as
# root:
#
#   bash /opt/liquiditywise/deploy/set-backup-secret.sh            keep an existing one
#   bash /opt/liquiditywise/deploy/set-backup-secret.sh --rotate   make a new one
#
# Nobody types it and nobody sees it. It is made here, written into a file
# only root and the application user can read, and handed to the Worker in
# deploy/backup-worker/ by a pipe that never shows it:
#
#   ssh root@<server> "grep -E '^BACKUP_SECRET=' /opt/liquiditywise/.env.local | cut -d= -f2-" |
#     npx wrangler secret put BACKUP_SECRET --config deploy/backup-worker/wrangler.toml
#
# A new one takes effect on both sides only once it has been piped: until then
# the Worker refuses the server's copies, and the health check says so the
# next morning.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_USER="${APP_USER:-liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"
STORE_URL="${STORE_URL:-https://liquiditywise.com/__backup}"

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is not there."; exit 1; }

existing="$(grep -E '^BACKUP_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
if [ -n "$existing" ] && [ "${1:-}" != "--rotate" ]; then
  secret="$existing"
  echo "BACKUP_SECRET is already set; keeping it. Pass --rotate for a new one."
else
  # 32 random bytes, as hex: 64 characters, and nothing in them a shell or a
  # URL treats specially.
  secret="$(openssl rand -hex 32)"
  echo "Made a new BACKUP_SECRET."
fi

SECRET="$secret" STORE_URL="$STORE_URL" python3 - "$ENV_FILE" <<'PY'
import os
import sys

path = sys.argv[1]
values = {"BACKUP_SECRET": os.environ["SECRET"], "BACKUP_URL": os.environ["STORE_URL"]}

with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines(keepends=True)

out, seen = [], set()
for line in lines:
    name = line.split("=", 1)[0]
    if name in values:
        out.append(f"{name}={values[name]}\n")
        seen.add(name)
    else:
        out.append(line)

missing = [name for name in values if name not in seen]
if missing:
    out.append("\n")
    out.extend(f"{name}={values[name]}\n" for name in missing)

with open(path, "w", encoding="utf-8") as handle:
    handle.write("".join(out))
PY

chmod 600 "$ENV_FILE"
chown "$APP_USER:$APP_USER" "$ENV_FILE"
unset secret existing
echo "Stored BACKUP_SECRET and BACKUP_URL=$STORE_URL. Pipe the secret to the Worker next."
