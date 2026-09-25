#!/usr/bin/env bash
# Gives the application an RPC endpoint on Base and on Arbitrum, made from the
# Ethereum one it already has. Run as root:
#
#   bash /opt/liquiditywise/deploy/set-chain-rpcs.sh
#
# An Alchemy key is one key for every network its app has enabled; only the
# host names the network (eth-mainnet, base-mainnet, arb-mainnet). So the two
# new endpoints are the Ethereum one with its host changed, written into
# .env.local here, on the machine, and never typed, copied or shown — the key
# does not leave the file it is already in.
#
# Each is then asked for its chain id, and the answer is the only thing
# printed. A network that is not enabled on the Alchemy app answers with an
# error rather than an id, and the line is left out of .env.local rather than
# written wrong.
#
# Idempotent: a line already there is tested and left as it is.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/liquiditywise}"
ENV_FILE="$APP_DIR/.env.local"

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is not there."; exit 1; }
ethereum="$(grep -E '^ETHEREUM_RPC_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
case "$ethereum" in
  https://eth-mainnet.g.alchemy.com/*) ;;
  "") echo "ETHEREUM_RPC_URL is empty; there is nothing to make the others from."; exit 1 ;;
  *) echo "ETHEREUM_RPC_URL is not an Alchemy mainnet endpoint; set BASE_RPC_URL and ARBITRUM_RPC_URL by hand."; exit 1 ;;
esac

# The chain id a working endpoint answers with: what proves it is the right network.
chain_id() {
  curl -s -m 10 -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$1" |
    sed -n 's/.*"result":"\(0x[0-9a-fA-F]*\)".*/\1/p'
}

# name, host, the chain id it must answer with
set_one() {
  local name="$1" host="$2" expected="$3"
  local existing url answer
  existing="$(grep -E "^$name=" "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  url="${existing:-${ethereum/eth-mainnet/$host}}"
  answer="$(chain_id "$url")"
  if [ "$answer" != "$expected" ]; then
    echo "$name: no answer as chain $expected (got '${answer:-nothing}'). Is the network enabled on the Alchemy app? Not written."
    return 1
  fi
  if [ -z "$existing" ]; then
    printf '%s=%s\n' "$name" "$url" >>"$ENV_FILE"
    echo "$name: written, answers as chain $answer."
  else
    echo "$name: already set, answers as chain $answer."
  fi
}

status=0
set_one BASE_RPC_URL base-mainnet 0x2105 || status=1
set_one ARBITRUM_RPC_URL arb-mainnet 0xa4b1 || status=1
exit "$status"
