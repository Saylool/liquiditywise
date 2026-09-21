# Running LiquidityWise on a server

One Ubuntu machine, Node 22, the application under systemd on port 3000,
Caddy in front of it with its own Let's Encrypt certificate, Cloudflare in
front of Caddy. Everything here is idempotent and lives in this directory.

## First time

As root on the server:

```bash
curl -fsSL https://raw.githubusercontent.com/Saylool/uniswapadvisor/main/deploy/setup.sh | bash
```

It installs Node and Caddy, clones the repository to `/opt/liquiditywise`,
copies `.env.example` to `.env.local` and stops. Fill the values in:

```bash
nano /opt/liquiditywise/.env.local
```

then run the same command again. It builds, starts the service, writes the
Caddyfile, and installs a cron entry that runs the Telegram check every five
minutes.

## Updating

```bash
bash /opt/liquiditywise/deploy/setup.sh
```

Pulls `main`, rebuilds, restarts. A few seconds of downtime while Next
restarts; Cloudflare serves an error page for that window.

## Cloudflare

- DNS: `A @ → server IP` and `A www → server IP`, both proxied.
- SSL/TLS: Full (strict). Caddy's certificate is a real one.
- The rate limiter keys visitors by `X-Real-IP`, which the Caddyfile fills
  from `CF-Connecting-IP`. Without that, every visitor would look like one of
  Cloudflare's edges.

## Telegram

After the first deploy, point the bot at this server from a machine that has
the bot's token in its `.env.local`:

```bash
node --env-file=.env.local scripts/setTelegramWebhook.mjs https://liquiditywise.com
```

## Files

- `setup.sh` — the whole install and update, as root.
- `liquiditywise.service` — the systemd unit. `.env.local` is read by Next.
- `Caddyfile` — TLS, the www redirect, the real-IP header.
- `telegram-check.sh` — one pass of the alert check; the cron entry calls it.
