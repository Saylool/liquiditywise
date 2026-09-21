#!/usr/bin/env bash
# Read-only. Says what already runs on this server so the install can fit
# around it: which web server owns ports 80/443, which sites it serves, which
# ports Node processes already use, and whether a process manager is in use.
# Changes nothing.
set -uo pipefail

echo "== listeners on 80/443/3000-3999 =="
ss -tlnp 2>/dev/null | awk 'NR==1 || $4 ~ /:(80|443|3[0-9][0-9][0-9])$/'
echo
echo "== web servers =="
for s in nginx apache2 caddy httpd; do systemctl is-active "$s" >/dev/null 2>&1 && echo "$s: active"; done
echo
echo "== nginx sites =="; ls /etc/nginx/sites-enabled 2>/dev/null; ls /etc/nginx/conf.d 2>/dev/null
echo "== caddy config =="; ls /etc/caddy 2>/dev/null; grep -hE '^[a-z0-9.-]+(\.[a-z]+)( |,|\{)' /etc/caddy/Caddyfile 2>/dev/null | head
echo
echo "== process managers =="
command -v pm2 >/dev/null && (pm2 ls 2>/dev/null | head -20) || echo "pm2: not installed"
systemctl list-units --type=service --state=running --no-pager --no-legend | grep -viE 'systemd|dbus|cron|ssh|getty|networkd|resolved|journald|udev|snapd|polkit|rsyslog|unattended|apparmor|qemu|multipath|ModemManager' | head -30
echo
echo "== node =="; command -v node && node -v || echo "node: not installed"
echo "== cron.d =="; ls /etc/cron.d 2>/dev/null
echo "== disk/mem =="; df -h / | tail -1; free -h | sed -n '2p'
