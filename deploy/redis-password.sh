#!/usr/bin/env bash
# Puts a password on the server's Redis and gives it to the application. Run
# as root:
#
#   bash /opt/liquiditywise/deploy/redis-password.sh
#
# Redis listens on loopback only, but loopback is every account on this shared
# machine: a site beside this one that was broken into could read every
# reader's address and chat id, or write links of its own. A password closes
# that. It is made here, never typed or shown, and handed to redis-cli on
# standard input and to the application inside REDIS_URL in .env.local, which
# only root and the application user can read.
#
# It refuses if any database but ours holds keys, the same test as
# redis-durability.sh: a password is per instance, and another application
# using this Redis without one would stop working.
#
# The order is what keeps the site up: the password goes on, then into
# .env.local, then the application restarts and reconnects with it. Between
# the first and the last, connections already open stay authenticated.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_USER="${APP_USER:-liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is not there."; exit 1; }
url="$(grep -E '^REDIS_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
case "$url" in
  redis://127.0.0.1:*|redis://localhost:*) ;;
  redis://:*@*) echo "REDIS_URL already carries a password; nothing to do."; exit 0 ;;
  *) echo "REDIS_URL is not a local Redis this script knows how to protect."; exit 1 ;;
esac

redis-cli PING >/dev/null 2>&1 || { echo "Redis is not answering, or already wants a password."; exit 1; }
ours="${url##*/}"
others="$(redis-cli INFO keyspace | sed -n 's/^db\([0-9]*\):keys=\([0-9]*\).*/\1 \2/p' | awk -v ours="$ours" '$1 != ours && $2 > 0 {print "db" $1}')"
if [ -n "$others" ]; then
  echo "Something else keeps data in this Redis ($others). A password would lock it out; nothing was changed."
  exit 1
fi

# 32 random bytes as hex: nothing in it that a URL or redis.conf treats specially.
password="$(openssl rand -hex 32)"

# On standard input, so the password is never an argument in the process list.
printf 'CONFIG SET requirepass %s\n' "$password" | redis-cli >/dev/null
REDISCLI_AUTH="$password" redis-cli CONFIG REWRITE >/dev/null || {
  echo "The password is on but could not be written to redis.conf, so a restart would drop it. Fix that before relying on it." >&2
  exit 1
}

PASSWORD="$password" python3 - "$ENV_FILE" <<'PY'
import os
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines(keepends=True)

out = []
for line in lines:
    if line.startswith("REDIS_URL=redis://"):
        rest = line[len("REDIS_URL=redis://"):]
        out.append(f"REDIS_URL=redis://:{os.environ['PASSWORD']}@{rest}")
    else:
        out.append(line)

with open(path, "w", encoding="utf-8") as handle:
    handle.write("".join(out))
PY
chmod 600 "$ENV_FILE"
chown "$APP_USER:$APP_USER" "$ENV_FILE"

systemctl restart liquiditywise
unset password
echo "Redis now asks for a password; the application has it and has restarted."
