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

On the machine this runs on, nginx already serves other sites, so:

```bash
bash /opt/liquiditywise/deploy/nginx-site.sh
```

It writes one file, symlinks it, tests the *whole* configuration and reloads
only if the test passed — a mistake here cannot take another site down. Then
it asks certbot for a certificate, which needs the name to resolve to this
machine: while Cloudflare proxies it, it does not, so the script says so and
stops. Set both A records to **DNS only**, run it again, then turn the proxy
back on.

For a machine running Caddy instead, `Caddyfile` holds the same site as one
block to import; Caddy fetches the certificate itself.

## 4. Cloudflare

- DNS: `A @` and `A www` → server IP, proxied. (Done.)
- SSL/TLS: Full (strict) once the origin has its certificate.
- The rate limiter keys visitors by `X-Real-IP`; both snippets fill it from
  `CF-Connecting-IP`. Without that, every visitor is one of Cloudflare's edges.

## 5. Where the links are kept

`setup.sh` installs Redis if the machine has none and leaves it bound to
`127.0.0.1`, where Ubuntu's package puts it. `.env.local` names it:

```
REDIS_URL=redis://127.0.0.1:6379/1
```

Database index 1 and a `liquiditywise:` prefix on every key, so a Redis
another site already uses stays that site's. Nothing is installed if one is
already running. To see what is there:

```bash
redis-cli -n 1 --scan --pattern 'liquiditywise:*'
```

There is no shared rate-limit counter and none is needed: one server is one
process, and the limiter counts in its own memory exactly.

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
