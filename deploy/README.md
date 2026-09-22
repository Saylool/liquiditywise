# Running LiquidityWise on a server

One Ubuntu machine that also serves other sites. The application runs under
systemd on a loopback port of its own; whatever already owns ports 80 and
443 on the machine proxies the domain to it. Nothing here installs a web
server or edits another site's configuration.

## 1. Look first

As root:

```bash
curl -fsSL https://raw.githubusercontent.com/Saylool/liquiditywise/main/deploy/inspect.sh | bash
```

Read-only. It lists what listens on 80/443 and 3000–3999, which web server
is active, its sites, and any Node processes — so the port and the proxy
can be chosen to fit.

## 2. Install the application

```bash
curl -fsSL https://raw.githubusercontent.com/Saylool/liquiditywise/main/deploy/setup.sh | APP_PORT=3200 bash
```

Installs Node 22 if the machine has none, clones to `/opt/liquiditywise`,
copies `.env.example` to `.env.local` and stops. Fill the values in
(`nano /opt/liquiditywise/.env.local`), then run the same command again:
it builds, starts the service on `127.0.0.1:$APP_PORT`, and installs a cron
entry that runs the Telegram check every five minutes. `APP_PORT` is any port
step 1 showed free.

Updating later is the same command; it pulls `main`, rebuilds, restarts.

**`raw.githubusercontent.com` caches a branch for a few minutes.** A run
started right after a push can fetch the previous version of this script and
fail in a way that has already been fixed — which cost an hour once. When
that matters, fetch the commit instead of the branch:

```bash
curl -fsSL https://raw.githubusercontent.com/Saylool/liquiditywise/<sha>/deploy/setup.sh | APP_PORT=3200 bash
```

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

## Checking the store on a machine that can open a port

The Redis client is covered by unit tests against a socket the tests write,
and by one suite against a real one. That suite binds a port, which the
sandbox this project is developed in cannot, so it is excluded from the
default run:

```bash
npx vitest run --config vitest.integration.mts
```

Worth running on the server after a deploy: it is the only thing that
exercises `node:net`, the connect timeout, and a reply arriving in the
pieces a real kernel chose.

## Replacing the bot token

If the token ever leaks — or just to rotate it — ask @BotFather for a new
one with `/revoke`, then on the server:

```bash
bash /opt/liquiditywise/deploy/set-telegram-token.sh
```

It prompts for the token without echoing it, checks Telegram accepts it
before writing anything, rewrites that one line of `.env.local`, restarts
the service and registers the webhook again. The token never appears in the
shell's history, in a `ps` listing or in any log.

## What the bot looks like

Everything a person sees before pressing Start is set from the server over
the Bot API — no clicking through BotFather:

```bash
bash /opt/liquiditywise/deploy/set-bot-profile.sh
```

Name, the "What can this bot do?" text, the one-line blurb and the command
menu, each in English and Turkish. Idempotent.

The photo is `bot-avatar.svg`: the site's mark on a square background,
square because Telegram crops a profile photo to a circle. Telegram wants a
JPG, so it is rendered once and uploaded with `setMyProfilePhoto`. Neither
`rsvg-convert` nor ImageMagick is installed on the server — the first render
was done in a browser canvas at 512x512, quality 0.9, about 11 KB — so
render it wherever you have a rasteriser and upload the file.

## When something breaks

`setup.sh` installs a second cron entry, `liquiditywise-health`, which runs
every five minutes and writes to your own Telegram chat when something is
broken and is going to stay broken:

- the site is not answering on its port;
- Redis is not answering, so links cannot be saved and no alert can go out;
- the scheduled alert pass has not run for half an hour;
- the TLS certificate has under ten days left and certbot has not renewed it;
- the disk is over 90% full — this machine serves other sites too.

Set `TELEGRAM_OPERATOR_CHAT_ID` in `.env.local` to the numeric id of your
chat with the bot, then prove it arrives:

```bash
liquiditywise-health --hello
```

Only changes are sent. A fault reported once is not reported again while it
lasts, and one line goes out when it clears. An outage over a weekend is two
messages.

What it deliberately does not do is guess. While the site is down its other
readings cannot be taken, so they are carried forward rather than declared
recovered — you will not be told the disk is fine by a check that could not
look at it.

The one thing it cannot cover is the machine being off, because it runs on
that machine. If that matters, point an outside uptime service at the site
as well; everything short of it is here.

The thresholds and the wording are not in the script. It measures what only
it can see — the certificate, the disk, whether the site answers at all —
and hands those to `/api/health`, which holds the judgement in
`src/lib/health/problems.ts` where it is covered by tests.

## Files

- `inspect.sh` — read-only survey of the machine.
- `setup.sh` — install and update of the application only, as root.
- `liquiditywise.service` — the systemd unit; the port is substituted in.
- `nginx-liquiditywise.conf`, `Caddyfile` — one site block each, for the
  server the machine already runs.
- `telegram-check.sh` — one pass of the alert check; the cron entry calls it.
- `health-check.sh` — the five-minute health check described above.
