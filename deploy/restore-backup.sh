#!/usr/bin/env bash
# Opens one backup, on the machine that holds the private key — not the
# server, which only ever has the certificate. Prints the snapshot on stdout
# and what it holds, in counts, on stderr.
#
#   ssh root@<server> "liquiditywise-backup --fetch 2026-09-24" > backup.p7m
#   deploy/restore-backup.sh backup.p7m ~/path/to/LiquidityWise-backup-key.pem > snapshot.json
#
# With no server to fetch from, download the value `backup/<day>` from the
# `liquiditywise-backups` namespace in the Cloudflare dashboard instead.
# Then, on the server that should hold the links:
#
#   REDIS_URL=redis://127.0.0.1:6379/1 node /opt/liquiditywise/deploy/store-backup.mts restore < snapshot.json
#
# It refuses a store that already holds links unless given --replace. The
# snapshot is every reader's address and chat id in plain text: delete it
# once it is restored.
#
# How much it will open. Whoever holds BACKUP_SECRET can put a file in the
# backup store, and the Worker caps what it takes at 20 MiB — of encrypted
# gzip, which says nothing about what it opens to: gzip expands a run of
# zeros a thousandfold, so 20 MiB can be 20 GiB. This used to open the whole
# thing into a shell variable before looking at it. Now it streams through
# openssl, gunzip and `head -c`, into a file only its owner can read, and
# refuses anything that runs past LIMIT before a byte of it is parsed.
#
# The limit, 128 MiB. A reader costs the snapshot about 1.5 KB — measured on
# a made-up store in exportStore's format: a Telegram link following six
# positions with smart-money ranges on three pools, an e-mail subscription,
# and both sets' members — so 10,000 readers make 14.6 MB, gzipped 3:1 to
# 4.8 MB. At that ratio the Worker's 20 MiB is about 60 MiB opened, some
# 40,000 readers; 128 MiB leaves twice that again for a store that compresses
# better or grows past it, and stays a size node reads in without trouble. A
# real backup larger than that is a store so much bigger than today's that
# raising RESTORE_LIMIT_BYTES for the one run, deliberately, is the right
# amount of friction.
set -euo pipefail

encrypted="${1:?the encrypted backup}"
key="${2:?the private key}"
here="$(cd "$(dirname "$0")" && pwd)"
LIMIT="${RESTORE_LIMIT_BYTES:-$((128 * 1024 * 1024))}"

# mktemp makes it 0600; the chmod says so where it can be read. Removed
# however this ends: it is the plain text of every link.
plain="$(mktemp "${TMPDIR:-/tmp}/liquiditywise-restore.XXXXXX")"
trap 'rm -f "$plain"' EXIT
chmod 600 "$plain"

# One byte past the limit is read, so "exactly at the limit" and "over it"
# can be told apart. head stopping early ends gunzip with a broken pipe, which
# is why the statuses are looked at only after the size: an oversized backup
# is reported as that, not as a decryption error.
set +e
openssl cms -decrypt -binary -inform DER -in "$encrypted" -inkey "$key" |
  gunzip |
  head -c "$((LIMIT + 1))" > "$plain"
statuses=("${PIPESTATUS[@]}")
set -e

size=$(($(wc -c < "$plain")))
if [ "$size" -gt "$LIMIT" ]; then
  echo "The backup opens to more than $LIMIT bytes; refusing it. If it is genuine, run again with RESTORE_LIMIT_BYTES set higher." >&2
  exit 1
fi
for status in "${statuses[@]}"; do
  if [ "$status" != 0 ]; then
    echo "The backup could not be decrypted and unzipped (openssl, gunzip, head: ${statuses[*]})." >&2
    exit 1
  fi
done

node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$here/store-backup.mts" describe < "$plain" >&2
cat "$plain"
