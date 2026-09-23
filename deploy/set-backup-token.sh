#!/usr/bin/env bash
# Stores the Cloudflare API token the daily backup writes with, finds or makes
# the KV namespace the backups live in, and takes the first backup on the
# spot. Run as root:
#
#   bash /opt/liquiditywise/deploy/set-backup-token.sh
#
# or, with the token on the clipboard of the machine you are typing on:
#
#   pbpaste | ssh root@<server> "bash /opt/liquiditywise/deploy/set-backup-token.sh"
#
# The token needs one permission: Account → Workers KV Storage → Edit. It is
# read at a prompt that does not echo, goes straight into a file only root and
# the application user can read, and is never printed or passed as an argument.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
APP_USER="${APP_USER:-liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"
API="${CLOUDFLARE_API:-https://api.cloudflare.com/client/v4}"
NAMESPACE_TITLE="liquiditywise-backups"

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is not there."; exit 1; }

printf 'Paste the Cloudflare API token for backups, then press Enter.\n'
printf 'It will not appear on screen: '
# A token piped in has no newline after it, and `read` then reports failure
# having read it all. Whatever arrived is checked below either way.
token=""
IFS= read -rs token || true
printf '\n'
token="$(printf '%s' "$token" | tr -d '[:space:]')"

# Opaque to this script, and Cloudflare has more than one format — some with
# a dot in them. This only turns away an empty clipboard or a sentence; the
# token is judged by Cloudflare itself below.
if ! printf '%s' "$token" | grep -qE '^[A-Za-z0-9._-]{30,300}$'; then
  # Its shape, never its content: enough to tell an empty clipboard from a
  # token in a format this does not expect.
  odd="$(printf '%s' "$token" | tr -d 'A-Za-z0-9._-' | fold -w1 | sort -u | tr -d '\n')"
  echo "That does not look like a Cloudflare API token (${#token} characters${odd:+, including \"$odd\"}). Nothing was changed."
  exit 1
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/liquiditywise-backup-token.XXXXXX")"
trap 'rm -rf "$work"' EXIT
chmod 700 "$work"
printf 'Authorization: Bearer %s\n' "$token" > "$work/auth"

cf() { curl -sS -m 30 -H @"$work/auth" -H "Content-Type: application/json" "$@"; }

# Reads a field out of a Cloudflare answer, or prints nothing.
field() {
  python3 -c 'import json, sys
try:
    answer = json.load(sys.stdin)
except ValueError:
    sys.exit(0)
path = sys.argv[1]
if not answer.get("success"):
    sys.exit(0)
value = answer.get("result")
if path == "status":
    print(value.get("status", "") if isinstance(value, dict) else "")
elif path == "accounts":
    for account in value or []:
        print(account["id"], account.get("name", ""))
elif path.startswith("namespace:"):
    for namespace in value or []:
        if namespace.get("title") == path.split(":", 1)[1]:
            print(namespace["id"])
            break
elif path == "id":
    print(value.get("id", "") if isinstance(value, dict) else "")
' "$1"
}

account="$(grep -E '^CLOUDFLARE_ACCOUNT_ID=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
if [ -z "$account" ]; then
  accounts="$(cf "$API/accounts" | field accounts || true)"
  if [ "$(printf '%s\n' "$accounts" | grep -c .)" = "1" ]; then
    account="${accounts%% *}"
  else
    # An account token cannot be verified before its account is known, but a
    # rejected one lists no accounts either — say so rather than ask for an
    # id the token would not have worked with anyway.
    if [ -z "$accounts" ] && [ "$(cf "$API/user/tokens/verify" | field status || true)" != "active" ] &&
      [ "$(cf "$API/accounts?per_page=1" | head -c 200 | grep -c '"success":true' || true)" = "0" ]; then
      echo "Cloudflare does not accept that token. Nothing was changed."
      exit 1
    fi
    echo "Which Cloudflare account? It is the long id in the dashboard's address bar."
    [ -n "$accounts" ] && printf '%s\n' "$accounts"
    printf 'Account id: '
    read -r account < /dev/tty 2>/dev/null || {
      echo; echo "No terminal to ask on. Put CLOUDFLARE_ACCOUNT_ID=<id> in $ENV_FILE and run this again. Nothing was changed."
      exit 1
    }
  fi
fi
printf '%s' "$account" | grep -qE '^[0-9a-f]{32}$' || { echo "That is not an account id. Nothing was changed."; exit 1; }

status="$(cf "$API/accounts/$account/tokens/verify" | field status || true)"
[ -n "$status" ] || status="$(cf "$API/user/tokens/verify" | field status || true)"
if [ "$status" != "active" ]; then
  echo "Cloudflare does not accept that token as active. Nothing was changed."
  exit 1
fi
echo "Cloudflare accepts the token."

namespaces="$API/accounts/$account/storage/kv/namespaces"
namespace="$(cf "$namespaces?per_page=100" | field "namespace:$NAMESPACE_TITLE" || true)"
if [ -z "$namespace" ]; then
  namespace="$(cf -X POST --data "{\"title\":\"$NAMESPACE_TITLE\"}" "$namespaces" | field id || true)"
  [ -n "$namespace" ] || {
    echo "The token cannot create a KV namespace. It needs Account → Workers KV Storage → Edit. Nothing was changed."
    exit 1
  }
  echo "Created the KV namespace $NAMESPACE_TITLE."
else
  echo "Using the KV namespace $NAMESPACE_TITLE."
fi

TOKEN="$token" ACCOUNT="$account" NAMESPACE="$namespace" python3 - "$ENV_FILE" <<'PY'
import os
import sys

path = sys.argv[1]
values = {
    "CLOUDFLARE_BACKUP_TOKEN": os.environ["TOKEN"],
    "CLOUDFLARE_ACCOUNT_ID": os.environ["ACCOUNT"],
    "BACKUP_KV_NAMESPACE_ID": os.environ["NAMESPACE"],
}

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
unset token

echo "Stored. Taking the first backup now:"
backup="/usr/local/bin/liquiditywise-backup"
[ -x "$backup" ] || backup="$APP_DIR/deploy/backup.sh"
bash "$backup"
