#!/usr/bin/env bash
# Lets only Cloudflare reach liquiditywise.com. Run as root; nginx-site.sh
# runs it once the certificate is in place, and cron runs it weekly:
#
#   bash /opt/liquiditywise/deploy/cloudflare-only.sh
#
# Why. The site sits behind Cloudflare, and nginx hands the application the
# visitor's address from the CF-Connecting-IP header, which is what the rate
# limit on the paid reads counts by. Cloudflare writes that header — but only
# on requests that come through Cloudflare. The server also answers anyone who
# connects to its address directly, and such a request can carry any
# CF-Connecting-IP it likes: a new address on every request, a fresh
# rate-limit bucket every time, and no ceiling on what the model and The Graph
# are asked to do. Refusing every connection that is not from Cloudflare makes
# the header Cloudflare's again.
#
# The list is Cloudflare's own, from its API. It is written to
# /var/lib/liquiditywise/cloudflare-allow.conf only after every line has been
# checked to be an address range. The site's HTTPS block — the one certbot
# made — is then made to include it, and to pass on CF-Connecting-IP as the
# only forwarded address. Both are checked on every run, so a certbot that
# rewrites the file later gets them back the next Monday.
#
# nginx is reloaded only when something changed and the whole configuration
# still tests clean; if it does not, the list and the site file are both put
# back as they were. The port-80 blocks are left open: they only redirect, and
# Let's Encrypt renews through them.
set -euo pipefail

OUT="${OUT:-/var/lib/liquiditywise/cloudflare-allow.conf}"
SITE="${SITE:-/etc/nginx/sites-available/liquiditywise.com}"
SOURCE="${SOURCE:-https://api.cloudflare.com/client/v4/ips}"
NGINX="${NGINX:-nginx}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ -f "$SITE" ] || { echo "$SITE is not there." >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"
next="$(mktemp "$OUT.XXXXXX")"
patched="$(mktemp "$OUT.site.XXXXXX")"
trap 'rm -f "$next" "$patched"' EXIT

# The list, checked range by range.
curl -sS --fail -m 30 "$SOURCE" | python3 "$HERE/cloudflare_only.py" allow-list > "$next"

# The site file as it should be. Written to a scratch file; the real one is
# untouched until the list is in place too.
python3 "$HERE/cloudflare_only.py" patch-site "$SITE" "$OUT" > "$patched"

list_changed=1; [ -f "$OUT" ] && cmp -s "$next" "$OUT" && list_changed=0
site_changed=1; cmp -s "$patched" "$SITE" && site_changed=0
if [ "$list_changed" = 0 ] && [ "$site_changed" = 0 ]; then
  echo "Cloudflare's address list and the site's use of it are unchanged."
  exit 0
fi

previous_list=""; [ -f "$OUT" ] && previous_list="$(cat "$OUT")"
previous_site="$(cat "$SITE")"
chmod 644 "$next"
mv "$next" "$OUT"
cat "$patched" > "$SITE"

if ! "$NGINX" -t >/dev/null 2>&1; then
  if [ -n "$previous_list" ]; then printf '%s\n' "$previous_list" > "$OUT"; else rm -f "$OUT"; fi
  printf '%s\n' "$previous_site" > "$SITE"
  echo "nginx -t failed; the list and the site file are both back as they were. Nothing was reloaded." >&2
  exit 1
fi
"$NGINX" -s reload
echo "Only Cloudflare reaches liquiditywise.com now: $(grep -c '^allow' "$OUT") ranges allowed, everything else refused."
