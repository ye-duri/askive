#!/bin/zsh
cd "$(dirname "$0")"
echo '인쇄 도우미를 등록합니다. 처음 한 번 완료하면 다음 Mac 로그인부터 자동 실행됩니다.'
if /bin/zsh ./install.sh; then
  PRINT_DEVICE_ID="$(/usr/bin/plutil -extract id raw -o - "$HOME/Library/Application Support/YonseiStudioPrint/relay.json")"
  open "https://askive.pages.dev/print/#printerDevice=$PRINT_DEVICE_ID"
  echo '완료되었습니다. 이 터미널 창은 닫아도 됩니다.'
else
  echo '설치 또는 실행을 완료하지 못했습니다. 위 오류 내용을 확인해 주세요.'
  read
  exit 1
fi
