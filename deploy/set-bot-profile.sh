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

DESC_EN='Tells you when a Uniswap position nears its range edge, leaves it, or comes back; on a leave, also what the pool paid in range last week and the fee to re-centre. /watch <pool> follows a pool suggested range instead; no address needed.

Kept only what you ask: this chat and the address; /smart adds a smart-money range, /weekly the last digest time, /watch the pool and the range last told. /stop deletes all at once, from encrypted backups in seven days.

Public chain data; cannot sign or send. Not advice.'

DESC_TR='Uniswap pozisyonun aralık sınırına yaklaşınca, çıkınca ya da geri girince haber verir; çıkınca havuzun geçen hafta aralıkta ödediğini ve yeniden ortalamanın takas komisyonunu da. /watch <havuz> adres gerekmeden bir havuzun önerilen aralığını izler.

Yalnızca istediğin saklanır: bu sohbet ve adres; /smart akıllı para aralığını, /weekly son özet zamanını, /watch havuzu ve son aralığı ekler. /stop hepsini hemen, şifreli yedeklerden de yedi günde siler.

Açık zincir verisi; imzalamaz, göndermez. Tavsiye değil.'

SHORT_EN='Tells you when a Uniswap position leaves its range, or a pool suggested range moves. liquiditywise.com'
SHORT_TR='Uniswap pozisyonun aralıktan çıkınca ya da bir havuzun önerilen aralığı kayınca haber verir. liquiditywise.com'

api setMyName --data-urlencode 'name=LiquidityWise'

api setMyDescription --data-urlencode "description=$DESC_EN"
api setMyDescription --data-urlencode "description=$DESC_TR" --data-urlencode 'language_code=tr'

api setMyShortDescription --data-urlencode "short_description=$SHORT_EN"
api setMyShortDescription --data-urlencode "short_description=$SHORT_TR" --data-urlencode 'language_code=tr'

# Only the commands the bot actually answers. `/start` is listed because
# Telegram shows it anyway; a menu offering something the bot ignores is
# worse than a short menu. The three pool-watch commands need no link, so
# they sit right after /start.
api setMyCommands \
  --data-urlencode 'commands=[{"command":"start","description":"Link the address you chose on the site"},{"command":"watch","description":"Follow a pool suggested range: /watch [network] <pool>"},{"command":"unwatch","description":"Stop following a pool and delete what was kept"},{"command":"watches","description":"List the pools this chat follows"},{"command":"smart","description":"Also alert when smart money moves (on/off)"},{"command":"weekly","description":"Monday digest of where smart money moved (on/off)"},{"command":"stop","description":"Stop everything and forget the address and the pools"}]'
api setMyCommands \
  --data-urlencode 'commands=[{"command":"start","description":"Sitede seçtiğin adresi bağla"},{"command":"watch","description":"Bir havuzun önerilen aralığını izle: /watch [ağ] <havuz>"},{"command":"unwatch","description":"Havuzu izlemeyi bırak ve saklananı sil"},{"command":"watches","description":"Bu sohbetin izlediği havuzları listele"},{"command":"smart","description":"Akıllı para kayınca da haber ver (aç/kapat)"},{"command":"weekly","description":"Akıllı paranın pazartesi haftalık özeti (aç/kapat)"},{"command":"stop","description":"Her şeyi durdur; adresi ve havuzları unut"}]' \
  --data-urlencode 'language_code=tr'
