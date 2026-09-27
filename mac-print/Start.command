#!/bin/zsh
cd "$(dirname "$0")"
NODE_BIN="$(command -v node)"
if [[ -z "$NODE_BIN" ]]; then NODE_BIN="$HOME/.local/share/askive-node/node-v24.21.0-darwin-arm64/bin/node"; fi
if [[ ! -x "$NODE_BIN" ]]; then echo 'Node.js 실행 파일을 찾지 못했습니다.'; read; exit 1; fi
(sleep 2; open http://127.0.0.1:4178) &
/usr/bin/caffeinate -i "$NODE_BIN" server.mjs
