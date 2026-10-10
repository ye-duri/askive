#!/bin/zsh
set -e
set -o pipefail
RESOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
SUPPORT_DIR="$HOME/Library/Application Support/YonseiStudioPrint"
HELPER_DIR="$SUPPORT_DIR/helper"
AGENT_DIR="$HOME/Library/LaunchAgents"
AGENT_FILE="$AGENT_DIR/kr.yeduri.YonseiStudioPrint.plist"
LOG_DIR="$HOME/Library/Logs/YonseiStudioPrint"
case "$(uname -m)" in arm64) NODE_ARCH=arm64;; x86_64) NODE_ARCH=x64;; *) echo '지원하지 않는 Mac CPU입니다.'; exit 1;; esac
NODE_FOLDER="node-v24.21.0-darwin-$NODE_ARCH"
NODE_BIN="$HOME/.local/share/askive-node/$NODE_FOLDER/bin/node"
if [[ ! -x "$NODE_BIN" ]]; then NODE_BIN="$SUPPORT_DIR/runtime/$NODE_FOLDER/bin/node"; fi
if [[ ! -x "$NODE_BIN" ]]; then
  NODE_TEMP="$(mktemp -d)"
  trap 'rm -rf "$NODE_TEMP"' EXIT
  NODE_ARCHIVE="$NODE_FOLDER.tar.gz"
  /usr/bin/curl --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/v24.21.0/$NODE_ARCHIVE" -o "$NODE_TEMP/$NODE_ARCHIVE"
  /usr/bin/curl --fail --location --proto '=https' --tlsv1.2 'https://nodejs.org/dist/v24.21.0/SHASUMS256.txt' -o "$NODE_TEMP/SHASUMS256.txt"
  NODE_EXPECTED="$(awk -v file="$NODE_ARCHIVE" '$2==file {print $1}' "$NODE_TEMP/SHASUMS256.txt")"
  NODE_ACTUAL="$(/usr/bin/shasum -a 256 "$NODE_TEMP/$NODE_ARCHIVE" | awk '{print $1}')"
  [[ -n "$NODE_EXPECTED" && "$NODE_ACTUAL" == "$NODE_EXPECTED" ]] || { echo '런타임 파일 검증에 실패했습니다.'; exit 1; }
  mkdir -p "$SUPPORT_DIR/runtime"
  /usr/bin/tar -xzf "$NODE_TEMP/$NODE_ARCHIVE" -C "$SUPPORT_DIR/runtime"
fi
"$NODE_BIN" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a===24&&b>=21?0:1)'
# Preserve the existing jobs and connection settings; stop only this print helper.
EXISTING_PID="$(/usr/sbin/lsof -t -iTCP:4178 -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$EXISTING_PID" ]]; then
  "$NODE_BIN" -e 'fetch("http://127.0.0.1:4178/admin/state").then(r=>r.json()).then(d=>{if(d.jobs?.some(j=>j.state==="sending")){console.error("인쇄가 진행 중입니다. 끝난 뒤 다시 설치해 주세요.");process.exit(1);}}).catch(()=>process.exit(1))'
  EXISTING_COMMAND="$(ps -p "$EXISTING_PID" -o args=)"
  EXISTING_CWD="$(/usr/sbin/lsof -a -p "$EXISTING_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  if [[ "$EXISTING_COMMAND" != *"mac-print/server.mjs"* && "$EXISTING_COMMAND" != *"YonseiStudioPrint/helper/server.mjs"* && "$EXISTING_CWD" != *"mac-print" && "$EXISTING_CWD" != *"YonseiPrint" ]]; then
    echo '4178 포트를 다른 프로그램이 사용 중입니다. 기존 프로그램을 확인해 주세요.'; exit 1
  fi
fi
mkdir -p "$HELPER_DIR/public" "$AGENT_DIR" "$LOG_DIR"
chmod 700 "$SUPPORT_DIR" "$HELPER_DIR" "$LOG_DIR"
cp "$RESOURCE_DIR/server.mjs" "$RESOURCE_DIR/print-pdf.mjs" "$RESOURCE_DIR/relay.mjs" "$RESOURCE_DIR/enroll.mjs" "$HELPER_DIR/"
cp -R "$RESOURCE_DIR/public/." "$HELPER_DIR/public/"
if [[ ! -f "$SUPPORT_DIR/relay.json" ]] || ! "$NODE_BIN" "$HELPER_DIR/enroll.mjs" --check; then
  if [[ "${1:-}" == "--gui" ]]; then
    /usr/bin/osascript "$RESOURCE_DIR/password.applescript" | "$NODE_BIN" "$HELPER_DIR/enroll.mjs"
  elif [[ -t 0 ]]; then
    echo '최초 연결을 위해 인쇄관리 비밀번호를 입력해 주세요.'
    read -s PRINT_PASSWORD
    echo
    printf '%s' "$PRINT_PASSWORD" | "$NODE_BIN" "$HELPER_DIR/enroll.mjs"
    unset PRINT_PASSWORD
  else
    echo 'Start.command를 열어 최초 클라우드 연결을 완료해 주세요.'; exit 1
  fi
fi
/bin/launchctl bootout "gui/$(id -u)/kr.yeduri.YonseiStudioPrint" 2>/dev/null || true
if [[ -n "$EXISTING_PID" ]]; then kill -TERM "$EXISTING_PID" 2>/dev/null || true; fi
xml_escape(){ printf '%s' "$1" | sed 's/\&/\&amp;/g;s/</\&lt;/g;s/>/\&gt;/g'; }
cat > "$AGENT_FILE" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>kr.yeduri.YonseiStudioPrint</string>
<key>ProgramArguments</key><array><string>$(xml_escape "$NODE_BIN")</string><string>$(xml_escape "$HELPER_DIR/server.mjs")</string></array>
<key>WorkingDirectory</key><string>$(xml_escape "$HELPER_DIR")</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer>
<key>StandardOutPath</key><string>$(xml_escape "$LOG_DIR/helper.log")</string>
<key>StandardErrorPath</key><string>$(xml_escape "$LOG_DIR/helper-error.log")</string>
</dict></plist>
PLIST
chmod 600 "$AGENT_FILE"
/usr/bin/plutil -lint "$AGENT_FILE" >/dev/null
/bin/launchctl enable "gui/$(id -u)/kr.yeduri.YonseiStudioPrint"
/bin/launchctl bootstrap "gui/$(id -u)" "$AGENT_FILE"
"$NODE_BIN" -e 'const delay=ms=>new Promise(r=>setTimeout(r,ms));(async()=>{for(let i=0;i<30;i++){try{const r=await fetch("http://127.0.0.1:4178/admin/state");if(r.ok){console.log("설치 완료: 로그인 시 자동 실행됩니다.");return;}}catch{}await delay(500);}console.error("도우미 실행을 확인하지 못했습니다.");process.exit(1);})()'
