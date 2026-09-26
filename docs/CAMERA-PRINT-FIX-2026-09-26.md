# iPad 카메라·인쇄 개선

## 확인 및 변경
- 휴대폰 대화의 수정 요점을 확인해 현재 코드에 재구현했습니다. 해당 대화의 다운로드 수정 파일 자체는 이 작업에 제공되지 않아 동일 파일이라고 주장하지 않습니다.
- 촬영 화면을 먼저 표시한 뒤 카메라를 연결합니다. 권한 테스트 영상도 재생 전에 표시합니다.
- 장치 연결 20초, 재생 및 프레임 준비 각각 최대 12초 제한. 실패 시 다시 시도할 수 있으며, 시간 초과 후 늦게 도착한 스트림은 종료합니다.
- 영상 너비·높이와 readyState를 확인한 뒤 촬영합니다. 장치 목록 갱신이 재생 완료 처리를 막지 않습니다.
- 인쇄 기본값은 전체 표시입니다. 브라우저와 별도 HTML 인쇄 파일 모두 원본 비율을 유지합니다. 용지와 사진 비율이 다르면 여백이 생깁니다.
- 인쇄 설정 안에 사진 파일 공유 버튼을 제공합니다. 미리 준비한 JPG를 사용자 클릭에서 공유하며, 공유 미지원 시 다운로드합니다. 공유 취소를 인쇄 실패로 처리하지 않습니다.
- 이용 종료 시 공유용 파일 참조도 정리합니다.

## 검증
- tests/camera-ready.mjs: 완료·실패·시간 초과·늦은 스트림 정리·영상 준비·취소.
- tests/camera-recovery.mjs: 표시 후 재생, 재생 정지 재현 및 재시도, JPG 파일 공유, 인쇄 contain.
- tests/browser.mjs: 5개 에디션/컷 조합, 8장 자동 촬영, 필터, QR, 인쇄, 모바일.
- tests/security.mjs / tests/gallery.mjs: 기존 서버 보안·QR 만료·삭제 회귀.
- 실제 iPad, HD60 S+, CP1500 실물 출력은 자동 테스트 대상이 아닙니다.

## 직접 출력의 범위
웹 버튼은 시스템 인쇄 또는 공유 메뉴를 엽니다. 지정 프린터로 인쇄창 없이 보내려면 별도 iPad 앱의 UIKit 연결·설치·실기기 검증이 필요하며 이번 웹 배포에는 포함되지 않습니다.

## 근거
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- https://developer.apple.com/documentation/uikit/uiprintinteractioncontroller/print(to:completionhandler:)
