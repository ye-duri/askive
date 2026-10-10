#!/bin/zsh
cd "$(dirname "$0")"
NODE_BIN="$(command -v node)"
if [[ -z "$NODE_BIN" ]]; then NODE_BIN="$HOME/.local/share/askive-node/node-v24.21.0-darwin-arm64/bin/node"; fi
if [[ ! -x "$NODE_BIN" ]] || ! "$NODE_BIN" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a===24&&b>=21?0:1)' >/dev/null 2>&1; then
  case "$(uname -m)" in
    arm64) NODE_ARCH=arm64 ;;
    x86_64) NODE_ARCH=x64 ;;
    *) echo '이 Mac의 CPU를 지원하지 않습니다.'; read; exit 1 ;;
  esac
  NODE_RUNTIME="$HOME/Library/Application Support/YonseiStudioPrint/runtime"
  NODE_FOLDER="node-v24.21.0-darwin-$NODE_ARCH"
  NODE_BIN="$NODE_RUNTIME/$NODE_FOLDER/bin/node"
  if [[ ! -x "$NODE_BIN" ]]; then
    echo '최초 실행에 필요한 공식 Node.js 런타임을 준비합니다…'
    NODE_TEMP="$(mktemp -d)"
    NODE_ARCHIVE="$NODE_FOLDER.tar.gz"
    if ! /usr/bin/curl --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/v24.21.0/$NODE_ARCHIVE" -o "$NODE_TEMP/$NODE_ARCHIVE" || ! /usr/bin/curl --fail --location --proto '=https' --tlsv1.2 'https://nodejs.org/dist/v24.21.0/SHASUMS256.txt' -o "$NODE_TEMP/SHASUMS256.txt"; then
      echo '다운로드 실패. 인터넷을 확인한 뒤 다시 실행해 주세요.'; rm -rf "$NODE_TEMP"; read; exit 1
    fi
    NODE_EXPECTED="$(awk -v file="$NODE_ARCHIVE" '$2==file {print $1}' "$NODE_TEMP/SHASUMS256.txt")"
    NODE_ACTUAL="$(/usr/bin/shasum -a 256 "$NODE_TEMP/$NODE_ARCHIVE" | awk '{print $1}')"
    if [[ -z "$NODE_EXPECTED" || "$NODE_EXPECTED" != "$NODE_ACTUAL" ]]; then
      echo '런타임 파일 검증 실패.'; rm -rf "$NODE_TEMP"; read; exit 1
    fi
    mkdir -p "$NODE_RUNTIME"
    /usr/bin/tar -xzf "$NODE_TEMP/$NODE_ARCHIVE" -C "$NODE_RUNTIME" || { rm -rf "$NODE_TEMP"; read; exit 1; }
    rm -rf "$NODE_TEMP"
  fi
fi
(sleep 2; open https://askive.pages.dev/print/) &
/usr/bin/caffeinate -i "$NODE_BIN" server.mjs
