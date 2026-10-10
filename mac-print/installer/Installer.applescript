on run
  display dialog "연세스튜디오 인쇄 도우미를 설치합니다.\n\n설치 후 Mac에 로그인할 때 자동으로 실행됩니다. 최초 설치에는 인터넷 연결이 필요할 수 있습니다." buttons {"취소", "설치"} default button "설치" with title "연세스튜디오 인쇄 도우미"
  try
    set resourceFolder to POSIX path of (path to resource "install.sh")
    with timeout of 600 seconds
      do shell script "/bin/zsh " & quoted form of resourceFolder
    end timeout
    display dialog "설치가 완료되었습니다.\n\n앞으로는 Mac에 로그인할 때 자동으로 실행됩니다. 인쇄관리 페이지에서 인쇄관리 비밀번호로 로그인해 주세요." buttons {"인쇄관리 열기"} default button "인쇄관리 열기" with title "연세스튜디오 인쇄 도우미"
    open location "https://askive.pages.dev/print/"
  on error messageText number errorNumber
    if errorNumber is not -128 then
      display dialog "설치를 완료하지 못했습니다.\n\n" & messageText buttons {"확인"} default button "확인" with title "연세스튜디오 인쇄 도우미"
    end if
  end try
end run
