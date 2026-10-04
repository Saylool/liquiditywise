#!/usr/bin/env bash
# Gives the application an RPC endpoint on Base, Arbitrum, Unichain, OP Mainnet,
# Polygon, BNB Chain, Avalanche and Celo, made from the
# Ethereum one it already has, and the Uniswap subgraphs of each. Run as root:
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
# The URL goes to curl as a config line on standard input, not as an argument:
# arguments are in the process list, which every account on this shared
# machine can read, and the URL carries the key.
chain_id() {
  printf 'url = "%s"\n' "$1" |
    curl -s -m 10 -K - -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' |
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

# The Uniswap subgraphs of each chain, v3 and v4. Public ids, not credentials — the
# ones .env.example gives and says how they were chosen — written only where
# the file has none, so an id set by hand is kept.
set_public() {
  local name="$1" value="$2"
  if grep -qE "^$name=." "$ENV_FILE"; then
    echo "$name: already set."
  else
    sed -i "/^$name=\$/d" "$ENV_FILE"
    printf '%s=%s\n' "$name" "$value" >>"$ENV_FILE"
    echo "$name: written."
  fi
}

status=0
set_one BASE_RPC_URL base-mainnet 0x2105 || status=1
set_one ARBITRUM_RPC_URL arb-mainnet 0xa4b1 || status=1
set_one UNICHAIN_RPC_URL unichain-mainnet 0x82 || status=1
set_one OPTIMISM_RPC_URL opt-mainnet 0xa || status=1
set_one POLYGON_RPC_URL polygon-mainnet 0x89 || status=1
set_one BNB_RPC_URL bnb-mainnet 0x38 || status=1
set_one AVALANCHE_RPC_URL avax-mainnet 0xa86a || status=1
set_one CELO_RPC_URL celo-mainnet 0xa4ec || status=1
set_public UNISWAP_V3_BASE_SUBGRAPH_ID 43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG
set_public UNISWAP_V3_ARBITRUM_SUBGRAPH_ID FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM
set_public UNISWAP_V4_ARBITRUM_SUBGRAPH_ID D1VHPU6cXXSC8eaApWCjCnPcTZQFSYCpGoDAvt4ogDWh
set_public UNISWAP_V4_BASE_SUBGRAPH_ID Gqm2b5J85n1bhCyDMpGbtbVn4935EvvdyHdHrx3dibyj
set_public UNISWAP_V4_UNICHAIN_SUBGRAPH_ID GjUSgVwFYnUAXf9ixkJFzrwkG1CdXhfdBKswLJEtZ5e
set_public UNISWAP_V3_OPTIMISM_SUBGRAPH_ID 49LkWjoVKd3bM9ZrMdFgYkjaCuVj4ExZttQi6XfbcPpG
set_public UNISWAP_V4_OPTIMISM_SUBGRAPH_ID Ab7CAcb1yPXUU2j9Bha1BPDHjE5QqUtjC3rPYyAyodJA
set_public UNISWAP_V3_POLYGON_SUBGRAPH_ID 3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm
set_public UNISWAP_V4_POLYGON_SUBGRAPH_ID 2CB2uQxcDKWDenagn2z17KQVCtfwSx5eXYuvqTciRTJu
set_public UNISWAP_V3_BNB_SUBGRAPH_ID 7XgdLW3bts4HktCYsu9dy8bEnuiNeZuftcuK3Aj4JXYV
set_public UNISWAP_V4_BNB_SUBGRAPH_ID EAq1nJKgjnuKH6Gj4RFjCW7LcL7E2uipbncdwV7TTWkX
set_public UNISWAP_V3_AVALANCHE_SUBGRAPH_ID 6yLTrSzuv11uQizC1rZskEYbBve3Me5azjbY28MTAmhh
set_public UNISWAP_V4_AVALANCHE_SUBGRAPH_ID AbFwkbD1Gnj9vXwoLZMr5fo2xEs8MbSe9cf6TofvgYmK
set_public UNISWAP_V3_CELO_SUBGRAPH_ID 6thLVqcdLLqhRKy1BzRn34VkfaQ1xfgt1m6eyPNM4e26
set_public UNISWAP_V3_BASE_POSITIONS_SUBGRAPH_ID GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz
set_public UNISWAP_V3_OPTIMISM_POSITIONS_SUBGRAPH_ID Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj
set_public UNISWAP_V3_ARBITRUM_POSITIONS_SUBGRAPH_ID HyW7A86UEdYVt5b9Lrw8W2F98yKecerHKutZTRbSCX27
exit "$status"
