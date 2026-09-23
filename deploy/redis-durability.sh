#!/usr/bin/env bash
# Turns on Redis's append-only log, so a link survives the machine restarting.
#
# Out of the box this Redis saves with `save 3600 1`: one changed key is
# written to disk an hour later. A reader who links a chat is told they are
# linked straight away, and if the machine restarts inside that hour the link
# is gone with nothing to say so. An append-only log with `everysec` narrows
# that to a second.
#
# Separate from setup.sh, and deliberately. setup.sh installs a Redis only
# when the machine has none, precisely because the one it finds may belong to
# another site — and persistence is not a per-database setting, so turning it
# on reaches every user of the instance. That is a decision to take once,
# knowingly, with a look at who else is there. Hence this script, which
# refuses rather than guesses.
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"

ours="$(grep -E '^REDIS_URL=' "$APP_DIR/.env.local" 2>/dev/null | head -1 | sed -E 's#.*/([0-9]+)[^0-9]*$#\1#')"
case "$ours" in ''|*[!0-9]*) ours=0 ;; esac
echo "this application uses database $ours"

command -v redis-cli >/dev/null || { echo "no redis-cli on this machine"; exit 1; }

# Once redis-password.sh has run, REDIS_URL carries the password; redis-cli
# takes it from its environment, never as an argument others could read.
redis_url="$(grep -E '^REDIS_URL=' "$APP_DIR/.env.local" 2>/dev/null | head -1 | cut -d= -f2- || true)"
case "$redis_url" in redis://:*@*) p="${redis_url#redis://:}"; export REDISCLI_AUTH="${p%%@*}"; unset p ;; esac
redis-cli PING >/dev/null 2>&1 || { echo "redis is not answering"; exit 1; }

# Who else is in there. A database with keys that is not ours means the
# instance is shared, and a shared service is not ours to reconfigure.
others="$(redis-cli INFO keyspace | sed -n 's/^db\([0-9]*\):keys=\([0-9]*\).*/\1 \2/p' | awk -v ours="$ours" '$1 != ours && $2 > 0 {print "db" $1 " (" $2 " keys)"}')"
if [ -n "$others" ]; then
  echo "refusing: this Redis also holds $others"
  echo "Persistence applies to the whole instance, so this is somebody else's"
  echo "decision too. Ask them, then set it by hand if they agree."
  exit 1
fi

current="$(redis-cli CONFIG GET appendonly | tail -1)"
if [ "$current" = "yes" ]; then
  echo "append-only log is already on; nothing to do"
else
  redis-cli CONFIG SET appendonly yes >/dev/null
  # At most one second of writes can be lost, and a fast disk is not assumed.
  redis-cli CONFIG SET appendfsync everysec >/dev/null
  # Written back to redis.conf, or the whole thing lasts until the next restart
  # — which is the very event it exists to survive.
  redis-cli CONFIG REWRITE >/dev/null || { echo "could not write redis.conf; the change is live but will not survive a restart"; exit 1; }
  echo "append-only log turned on and written to redis.conf"
fi

echo "--- now ---"
redis-cli INFO persistence | grep -E '^(aof_enabled|aof_last_write_status|aof_rewrite_in_progress|rdb_changes_since_last_save):'
redis-cli CONFIG GET appendfsync | tail -1 | sed 's/^/appendfsync /'
