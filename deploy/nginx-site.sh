#!/usr/bin/env bash
# Puts liquiditywise.com in front of the application, on an nginx that already
# serves other sites. Run as root:
#
#   bash /opt/liquiditywise/deploy/nginx-site.sh
#
# It writes one file, symlinks it, tests the whole configuration, and reloads
# only if the test passed — so a mistake here cannot take another site down.
# It then asks certbot for a certificate, which needs the name to resolve to
# this machine: while Cloudflare proxies it, it does not, and the script says
# so and stops rather than leaving a half-configured site behind.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
DOMAIN="liquiditywise.com"
SITE="/etc/nginx/sites-available/$DOMAIN"
LINK="/etc/nginx/sites-enabled/$DOMAIN"
EMAIL="${CERTBOT_EMAIL:-sametgoc81tr@gmail.com}"

command -v nginx >/dev/null || { echo "nginx is not installed on this machine."; exit 1; }

# The application has to be answering before anything is pointed at it.
port="$(grep -oE 'Environment=PORT=[0-9]+' /etc/systemd/system/liquiditywise.service | cut -d= -f3)"
[ -n "$port" ] || { echo "liquiditywise.service is not installed; run deploy/setup.sh first."; exit 1; }
if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/")" != "200" ]; then
  echo "The application is not answering on 127.0.0.1:$port. Run deploy/setup.sh first."
  exit 1
fi

# Only this site's file is written, and only this site's link is made.
sed "s#127\.0\.0\.1:3200#127.0.0.1:$port#" "$APP_DIR/deploy/nginx-liquiditywise.conf" > "$SITE"
ln -sfn "$SITE" "$LINK"

# The test covers every site on the machine. If ours broke something, ours goes.
if ! nginx -t; then
  rm -f "$LINK"
  echo "nginx refused the configuration; the site was removed and nothing was reloaded."
  exit 1
fi
systemctl reload nginx
echo "nginx is serving $DOMAIN to 127.0.0.1:$port"

# The certificate. HTTP-01 needs the name to point here, which it does not
# while Cloudflare proxies it — so this is checked rather than attempted.
here="$(curl -s -4 https://api.ipify.org || true)"
resolved="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}')"
if [ -n "$here" ] && [ "$resolved" != "$here" ]; then
  echo
  echo "$DOMAIN resolves to $resolved, not to this machine ($here)."
  echo "Cloudflare is proxying it. Set both A records to DNS only, wait a minute,"
  echo "run this script again, and turn the proxy back on afterwards."
  exit 0
fi

certbot --nginx --non-interactive --agree-tos --redirect \
  -m "$EMAIL" -d "$DOMAIN" -d "www.$DOMAIN"

nginx -t && systemctl reload nginx
echo
echo "https://$DOMAIN is served from this machine. Turn the Cloudflare proxy back"
echo "on and set SSL/TLS to Full (strict)."
