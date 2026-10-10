on run
  try
    display dialog "이 Mac에 인쇄 도우미를 설치하고 연결합니다.\n\nCP1500을 USB로 연결해 주세요. 설치는 한 번만 하면 됩니다." buttons {"취소", "설치"} default button "설치" cancel button "취소" with title "연세스튜디오 인쇄 도우미"
    set resourceFile to POSIX path of (path to resource "install.sh")
    with timeout of 600 seconds
      do shell script "/bin/zsh " & quoted form of resourceFile & " --gui"
    end timeout
    set deviceFile to (POSIX path of (path to home folder)) & "Library/Application Support/YonseiStudioPrint/relay.json"
    set deviceID to do shell script "/usr/bin/plutil -extract id raw -o - " & quoted form of deviceFile
    display dialog "설치와 연결이 완료되었습니다.\n\n인쇄관리 페이지에 로그인하면 이 Mac의 프린터가 표시됩니다. 이 설치 앱은 닫아도 됩니다." buttons {"인쇄관리 열기"} default button "인쇄관리 열기" with title "연세스튜디오 인쇄 도우미"
    open location ("https://askive.pages.dev/print/#printerDevice=" & deviceID)
  on error messageText number errorNumber
    if errorNumber is not -128 then
      if messageText does not contain "User canceled" and messageText does not contain "(-128)" then
        display dialog "설치를 완료하지 못했습니다.\n\n" & messageText buttons {"확인"} default button "확인" with title "연세스튜디오 인쇄 도우미"
      end if
    end if
  end try
end run
