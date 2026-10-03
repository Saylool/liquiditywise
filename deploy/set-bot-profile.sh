#!/usr/bin/env bash
# Sets what a person sees before they ever press Start: the bot's name, the
# "What can this bot do?" block, the one-line blurb under its photo, and the
# command list. Run as root on the server:
#
#   bash /opt/liquiditywise/deploy/set-bot-profile.sh
#
# Idempotent — it says the same thing every time. Telegram keeps a separate
# text per language code, so the Turkish reader gets Turkish and everybody
# else gets English; the default (no language_code) is the English one.
#
# The photo is set separately, from deploy/bot-avatar.svg — see the README.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$APP_DIR/.env.local" | head -1 | cut -d= -f2- || true)"
[ -n "$token" ] || { echo "TELEGRAM_BOT_TOKEN is not set in $APP_DIR/.env.local"; exit 1; }

api() {
  local method="$1"; shift
  # --data-urlencode keeps the text out of the URL and handles the newlines.
  local out
  # The token goes to curl on standard input, never on its command line.
  out="$(printf 'url = "https://api.telegram.org/bot%s/%s"\n' "$token" "$method" | curl -sS -m 20 -K - -X POST "$@")"
  printf '%s %s\n' "$method" "$(printf '%s' "$out" | grep -oE '"ok":(true|false)')"
}

DESC_EN='This bot follows the Uniswap positions of one address and tells you when one nears the edge of its range, leaves it, or comes back.

You link an address on liquiditywise.com; nothing is stored until you do, and then it is the address and this chat, plus a pool smart-money range with /smart and the last digest time with /weekly. /stop deletes all of it at once, and from the encrypted backups within seven days.

Reads public on-chain data; cannot sign or send anything. Information only, not advice.'

DESC_TR='Bu bot bir adresin Uniswap pozisyonlarını izler ve içlerinden biri aralığının sınırına yaklaştığında, çıktığında ya da geri girdiğinde haber verir.

Adresi liquiditywise.com üzerinden bağlarsın; bağlamadan önce hiçbir şey saklanmaz, sonra adres ile bu sohbet saklanır; /smart ile havuzun akıllı para aralığı, /weekly ile son özetin zamanı. /stop yazarsan hepsi hemen, şifreli yedeklerden de yedi günde silinir.

Herkese açık zincir verisini okur; imzalayamaz, işlem gönderemez. Yalnızca bilgi, tavsiye değil.'

SHORT_EN='Tells you when a Uniswap position leaves its range. liquiditywise.com'
SHORT_TR='Uniswap pozisyonun aralıktan çıkınca haber verir. liquiditywise.com'

api setMyName --data-urlencode 'name=LiquidityWise'

api setMyDescription --data-urlencode "description=$DESC_EN"
api setMyDescription --data-urlencode "description=$DESC_TR" --data-urlencode 'language_code=tr'

api setMyShortDescription --data-urlencode "short_description=$SHORT_EN"
api setMyShortDescription --data-urlencode "short_description=$SHORT_TR" --data-urlencode 'language_code=tr'

# Only the commands the bot actually answers. `/start` is listed because
# Telegram shows it anyway; a menu offering something the bot ignores is
# worse than a short menu.
api setMyCommands \
  --data-urlencode 'commands=[{"command":"start","description":"Link the address you chose on the site"},{"command":"smart","description":"Also alert when smart money moves (on/off)"},{"command":"weekly","description":"Monday digest of where smart money moved (on/off)"},{"command":"stop","description":"Stop the alerts and forget the address"}]'
api setMyCommands \
  --data-urlencode 'commands=[{"command":"start","description":"Sitede seçtiğin adresi bağla"},{"command":"smart","description":"Akıllı para kayınca da haber ver (aç/kapat)"},{"command":"weekly","description":"Akıllı paranın pazartesi haftalık özeti (aç/kapat)"},{"command":"stop","description":"Bildirimleri durdur ve adresi unut"}]' \
  --data-urlencode 'language_code=tr'
