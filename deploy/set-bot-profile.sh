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

DESC_EN='Follows the Uniswap positions of one address and tells you when one nears its range edge, leaves it, or comes back; on a leave, also what the pool paid in range last week and the swap fee to re-centre.

Link an address on liquiditywise.com; only then is anything kept: the address, this chat, a smart-money range with /smart, the last digest time with /weekly. /stop deletes it all at once, and from encrypted backups within seven days.

Reads public on-chain data; cannot sign or send. Information, not advice.'

DESC_TR='Bir adresin Uniswap pozisyonlarını izler; biri aralık sınırına yaklaşınca, çıkınca ya da geri girince haber verir; çıkınca havuzun geçen hafta aralıkta ödediğini ve yeniden ortalamanın takas komisyonunu da.

Adresi liquiditywise.com üzerinden bağlarsın; ancak o zaman saklanır: adres, bu sohbet, /smart ile akıllı para aralığı, /weekly ile son özet zamanı. /stop hepsini hemen, şifreli yedeklerden de yedi günde siler.

Herkese açık zincir verisini okur; imzalayamaz, gönderemez. Yalnızca bilgi, tavsiye değil.'

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
