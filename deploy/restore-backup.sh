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
set -euo pipefail

encrypted="${1:?the encrypted backup}"
key="${2:?the private key}"
here="$(cd "$(dirname "$0")" && pwd)"

snapshot="$(openssl cms -decrypt -binary -inform DER -in "$encrypted" -inkey "$key" | gunzip)"
printf '%s\n' "$snapshot" |
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$here/store-backup.mts" describe >&2
printf '%s\n' "$snapshot"
