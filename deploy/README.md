# Running LiquidityWise on a server

One Ubuntu machine that also serves other sites. The application runs under
systemd on a loopback port of its own; whatever already owns ports 80 and
443 on the machine proxies the domain to it. Nothing here installs a web
server or edits another site's configuration.

## 1. Look first

As root:

```bash
curl -fsSL https://raw.githubusercontent.com/Saylool/uniswapadvisor/main/deploy/inspect.sh | bash
```

Read-only. It lists what listens on 80/443 and 3000–3999, which web server
is active, its sites, and any Node processes — so the port and the proxy
can be chosen to fit.

## 2. Install the application

```bash
curl -fsSL https://raw.githubusercontent.com/Saylool/uniswapadvisor/main/deploy/setup.sh | APP_PORT=3200 bash
```

Installs Node 22 if the machine has none, clones to `/opt/liquiditywise`,
copies `.env.example` to `.env.local` and stops. Fill the values in
(`nano /opt/liquiditywise/.env.local`), then run the same command again:
it builds, starts the service on `127.0.0.1:$APP_PORT`, and installs a cron
entry that runs the Telegram check every five minutes. `APP_PORT` is any port
step 1 showed free.

Updating later is the same command; it pulls `main`, rebuilds, restarts.

## 3. Put the domain in front of it

Whichever server step 1 found:

- **nginx** — copy `nginx-liquiditywise.conf` to
  `/etc/nginx/sites-available/liquiditywise.com`, adjust the port, symlink
  it into `sites-enabled`, `nginx -t && systemctl reload nginx`, then
  `certbot --nginx -d liquiditywise.com -d www.liquiditywise.com`.
- **Caddy** — add the block in `Caddyfile` to the existing configuration
  (an `import` line, or paste it), `caddy validate`, `systemctl reload caddy`.
  Caddy fetches the certificate itself.

## 4. Cloudflare

- DNS: `A @` and `A www` → server IP, proxied. (Done.)
- SSL/TLS: Full (strict) once the origin has its certificate.
- The rate limiter keys visitors by `X-Real-IP`; both snippets fill it from
  `CF-Connecting-IP`. Without that, every visitor is one of Cloudflare's edges.

## 5. Telegram

From a machine with the bot token in its `.env.local`:

```bash
node --env-file=.env.local scripts/setTelegramWebhook.mjs https://liquiditywise.com
```

## Files

- `inspect.sh` — read-only survey of the machine.
- `setup.sh` — install and update of the application only, as root.
- `liquiditywise.service` — the systemd unit; the port is substituted in.
- `nginx-liquiditywise.conf`, `Caddyfile` — one site block each, for the
  server the machine already runs.
- `telegram-check.sh` — one pass of the alert check; the cron entry calls it.
