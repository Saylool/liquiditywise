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

## Making the store keep what it is given

Out of the box this Redis saves with `save 3600 1`: one changed key reaches
the disk an hour later. A reader who links a chat is told so immediately, and
a restart inside that hour takes the link with it and says nothing — they go
on believing they are being watched.

```bash
bash /opt/liquiditywise/deploy/redis-durability.sh
```

It turns on the append-only log with `appendfsync everysec`, so at most a
second of writes can be lost, and writes the setting back to `redis.conf` so
it survives the restart it exists for.

It is separate from `setup.sh` on purpose. `setup.sh` installs a Redis only
when the machine has none, because the one it finds may belong to another
site — and persistence is not a per-database setting, so turning it on
reaches every user of the instance. This script therefore looks at who else
is in there first and **refuses** if any database but ours holds keys, rather
than making that decision on somebody else's behalf.

The health check below reports it if the setting ever goes back.

## When something breaks

`setup.sh` installs a second cron entry, `liquiditywise-health`, which runs
every five minutes and writes to your own Telegram chat when something is
broken and is going to stay broken:

- the site is not answering on its port;
- Redis is not answering, so links cannot be saved and no alert can go out;
- Redis has stopped writing an append-only log, so a new link is a restart
  away from being lost;
- The Graph or the Ethereum RPC endpoint is refusing its key, which is the
  quietest way this breaks: every page still renders and every one of them
  says it could not reach its source;
- the scheduled alert pass has not run for half an hour;
- the TLS certificate has under ten days left and certbot has not renewed it;
- the disk is over 90% full — this machine serves other sites too.

These go to **Server Watch**, a Telegram bot of its own, and not to the
product bot. The product bot can message every reader who linked a chat; a
monitor has no business holding that, and the outside check below keeps a
copy of whichever token it is given on Cloudflare. Separate, the copy it keeps
can do nothing but report — and the product bot's chat stays the readers'.

Create the bot with @BotFather (`/newbot`, named Server Watch), open it and
press Start — a bot cannot write to anyone who has not — then store its token:

```bash
bash /opt/liquiditywise/deploy/set-server-watch-token.sh
```

It prompts without echoing, refuses the product bot's token, and sends a first
message before it stores anything, so a chat that cannot receive is found now
rather than on the night it matters. Messages start with `LiquidityWise ·` so
they read apart from the other sites'. Without the token the check falls back
to the product bot and says so in every message it sends.

Set `TELEGRAM_OPERATOR_CHAT_ID` in `.env.local` to the numeric id of your
chat — the same id for every bot — then prove it arrives:

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

The two paid credentials are asked about rather than waited for, at most
once an hour, with the answer kept in Redis in between. The questions are the
cheapest ones that still prove a key — `_meta` on the subgraph, which touches
no entity, and `eth_blockNumber` on the node — and only a 401 or 403 is
reported. A rate limit passes on its own and a provider having a bad minute is
not something you can act on; a message about either would teach you to ignore
the one that matters. Neither the key nor the RPC URL leaves the probe: it
resolves to an HTTP status and nothing else.

The thresholds and the wording are not in the script. It measures what only
it can see — the certificate, the disk, whether the site answers at all —
and hands those to `/api/health`, which holds the judgement in
`src/lib/health/problems.ts` where it is covered by tests.

The one thing it cannot cover is the machine being off, because it runs on
that machine. That is what `uptime-worker/` is for — see below.

## Backups

The Telegram links — an address and a chat id per reader, and the set the
alert pass walks — are the one thing this application keeps, and Redis keeps
them on one disk. The append-only log covers a crash; nothing else covered
losing the machine. `backup.sh`, installed as `liquiditywise-backup`, runs at
03:17 every day:

1. `store-backup.mts` copies every key under `liquiditywise:telegram:` out of
   Redis as JSON, each with the moment it expires — nothing else in Redis, and
   nothing of the other sites'. The copy is read back the way a restore reads
   it before anything is stored.
2. It is gzipped and encrypted to `backup-recipient.pem`. The private key is
   not on the server: the server can write a backup and cannot read one.
3. It is sent to the Worker in `backup-worker/`, on
   `liquiditywise.com/__backup/`, which keeps it in KV as `backup/<day>` for
   seven days and then lets KV delete it. It is read back and compared before
   the run counts as done.

The server holds no Cloudflare credential for this — only `BACKUP_SECRET`, a
random value shared with that Worker and nothing else. The Worker accepts
today's copy and no other day's, and has no delete, so a server someone else
controlled could not reach back and spoil the days before. Without the secret
every request gets the same 404 as an address that does not exist.

Seven days is also what readers are told: a link is deleted from the server
at once, and from the backups within seven days. A test holds the Worker's
retention and that sentence together.

A backup that stopped is reported by the health check through Server Watch
once the last one is more than 26 hours old.

To set it up, from `deploy/backup-worker/`, logged in with
`npx wrangler login`:

```bash
npx wrangler kv namespace create BACKUPS
```

Put the id it prints into `wrangler.toml`, deploy, make the secret on the
server, and hand it to the Worker without it ever being on screen:

```bash
npx wrangler deploy
ssh root@<server> "bash /opt/liquiditywise/deploy/set-backup-secret.sh"
ssh root@<server> "grep -E '^BACKUP_SECRET=' /opt/liquiditywise/.env.local | cut -d= -f2-" | npx wrangler secret put BACKUP_SECRET
ssh root@<server> liquiditywise-backup
```

Until the secret is on both sides the Worker refuses the server's copies,
which is also what a rotation (`set-backup-secret.sh --rotate`) looks like
until the new one has been piped across.

To restore, on the machine that holds the private key:

```bash
ssh root@<server> "liquiditywise-backup --list"
ssh root@<server> "liquiditywise-backup --fetch 2026-09-24" > backup.p7m
deploy/restore-backup.sh backup.p7m ~/path/to/LiquidityWise-backup-key.pem > snapshot.json
```

and on the server that should hold the links:

```bash
REDIS_URL=redis://127.0.0.1:6379/1 node /opt/liquiditywise/deploy/store-backup.mts restore < snapshot.json
```

It refuses a store that already holds links unless given `--replace`, and
restores each key with the expiry it had, not a fresh one. With no server to
fetch from, download `backup/<day>` from the Worker's KV namespace in the
Cloudflare dashboard. `snapshot.json` is every reader's address and chat id in plain
text: delete it once it is restored.

## When the machine itself is off

`deploy/uptime-worker/` is a Cloudflare Worker that asks every site this
server hosts — liquiditywise.com, ensdesk.com and splitstable.com — from
Cloudflare's own machines every five minutes, and tells Server Watch's chat
when they stop answering and when they come back. It needs no new account: the
sites are already served through Cloudflare, and a scheduled Worker, its KV
store and its cron trigger all fit in the free plan.

Watching all three is what lets it tell two outages apart. One site down while
the others answer is that site's problem, and the message says the server is
up. All three down together is the server, or its network, and the message
says that instead — once, not three times.

It asks liquiditywise at `/api/health` without credentials, so a live app
answers 401, and the other two at their home pages. Every address is
cache-busted with a query no cache has seen, because Cloudflare's "Always
Online" can serve a stored copy of a page while the origin is down — exactly
the moment this must not be fooled. The list is in `wrangler.toml`, and a test
reads it the way the Worker does: a typo there would not fail a deploy, it
would make every run throw, which is a monitor that never says anything.

Two failed checks in a row count as down, about ten minutes: one would
catch every deploy's few-second restart and send "down" then "recovered" for
nothing. It writes to KV only when its verdict changes, so an ordinary day
writes nothing against the free plan's thousand writes.

It has no URL on purpose — a public URL that sends a Telegram message is one
anyone can make send one. Trigger it for testing from the dashboard.

To deploy it, from `deploy/uptime-worker/`:

```bash
npx wrangler kv namespace create UPTIME
```

Put the id it prints into `wrangler.toml` as the `UPTIME` namespace's `id`,
then set the two secrets — each prompts, and neither value is written anywhere
in this repository. The token is Server Watch's, the one
`set-server-watch-token.sh` stored:

```bash
npx wrangler secret put SERVER_WATCH_BOT_TOKEN
npx wrangler secret put TELEGRAM_OPERATOR_CHAT_ID
npx wrangler deploy
```

Rather than pasting it, it can be piped from the server without ever being on
screen:

```bash
ssh root@<server> "grep -E '^SERVER_WATCH_BOT_TOKEN=' /opt/liquiditywise/.env.local | cut -d= -f2-" | npx wrangler secret put SERVER_WATCH_BOT_TOKEN
```

## Files

- `inspect.sh` — read-only survey of the machine.
- `setup.sh` — install and update of the application only, as root.
- `liquiditywise.service` — the systemd unit; the port is substituted in.
- `nginx-liquiditywise.conf`, `Caddyfile` — one site block each, for the
  server the machine already runs.
- `telegram-check.sh` — one pass of the alert check; the cron entry calls it.
- `health-check.sh` — the five-minute health check described above.
- `set-server-watch-token.sh` — stores Server Watch's token, as root, after
  checking it is not the product bot's and that your chat can receive from it.
- `cloudflare-only.sh`, `cloudflare_only.py` — let only Cloudflare's ranges reach the
  HTTPS block, so CF-Connecting-IP (what the rate limit counts) cannot be forged
  by connecting to the machine directly. Weekly from cron.
- `usage-report.sh`, `usage-report.mts` — the Monday report of the week's use,
  through Server Watch: pages, pools, languages, explanations and what they cost.
  Counted from the journal lines in `src/lib/usage/usageLines.ts`, which record
  no IP address, browser, search text or holdings address.
- `backup.sh` — the daily encrypted backup of the Telegram links, described above.
- `store-backup.mts` — copies the links out of Redis and back, under plain Node.
- `set-backup-secret.sh` — makes the secret the backup is sent with.
- `backup-worker/` — the Worker that keeps the backups, on Cloudflare.
- `restore-backup.sh` — opens a backup, where the private key is.
- `backup-recipient.pem` — the certificate backups are encrypted to. Public;
  its private key is kept off the server.
- `redis-durability.sh` — turns on the append-only log, if the Redis is ours.
- `redis-password.sh` — puts a password on the Redis, if it is ours, and hands it to
  the application in REDIS_URL. Made on the server, never typed or shown.
- `uptime-worker/` — the outside check, on Cloudflare, for all three sites and for when the machine is off.
