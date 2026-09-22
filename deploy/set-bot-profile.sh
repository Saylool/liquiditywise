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
token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$APP_DIR/.env.local" | head -1 | cut -d= -f2-)"
[ -n "$token" ] || { echo "TELEGRAM_BOT_TOKEN is not set in $APP_DIR/.env.local"; exit 1; }

api() {
  local method="$1"; shift
  # --data-urlencode keeps the text out of the URL and handles the newlines.
  local out
  out="$(curl -sS -m 20 -X POST "https://api.telegram.org/bot$token/$method" "$@")"
  printf '%s %s\n' "$method" "$(printf '%s' "$out" | grep -oE '"ok":(true|false)')"
}

DESC_EN='This bot follows the Uniswap positions of one Ethereum address and tells you when one of them leaves its price range or comes back into it.

You link an address on liquiditywise.com; nothing is stored until you do, and what is stored is the address and this chat, nothing else. Send /stop and both are gone.

It reads public on-chain data and sends a message. It cannot sign or send a transaction. Information only — not financial advice.'

DESC_TR='Bu bot bir Ethereum adresinin Uniswap pozisyonlarını izler ve içlerinden biri fiyat aralığından çıktığında ya da geri girdiğinde sana haber verir.

Adresi liquiditywise.com üzerinden bağlarsın; bağlamadan önce hiçbir şey saklanmaz, saklanan da adres ile bu sohbettir, başka bir şey değil. /stop yazarsan ikisi de silinir.

Herkese açık zincir verisini okur ve mesaj gönderir. Hiçbir şey imzalayamaz, işlem gönderemez. Yalnızca bilgi — yatırım tavsiyesi değildir.'

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
  --data-urlencode 'commands=[{"command":"start","description":"Link the address you chose on the site"},{"command":"stop","description":"Stop the alerts and forget the address"}]'
api setMyCommands \
  --data-urlencode 'commands=[{"command":"start","description":"Sitede seçtiğin adresi bağla"},{"command":"stop","description":"Bildirimleri durdur ve adresi unut"}]' \
  --data-urlencode 'language_code=tr'
