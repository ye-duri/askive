# 연세스튜디오

아이패드·휴대폰 행사 포토부스. 촬영·합성은 브라우저에서, 동의한 QR 앨범만 비공개 저장소에서 처리합니다.

## 사용 흐름

- 베이직: 종류 → 2/4/6컷 → 5초 간격 8장 자동 촬영 → 프레임 → 사진 선택 → 완성
- 특별에디션: 종류 → 4/6컷 → 함께찍기 프레임 → 5초 간격 8장 자동 촬영 → 사진 선택 → 완성
- 사진 필터: 원본 / 화사 / 선명 / 흑백. 프레임에는 적용하지 않습니다.
- QR 동의 시: 원본 촬영 사진 8장 + 필터·프레임을 적용한 완성본 1장. 생성 후 24시간 접근 가능.
- 이용 종료는 기기 데이터만 정리합니다. 결과 화면의 QR 앨범 삭제는 서버 사본도 삭제합니다.
- 카메라 안내는 같은 탭의 이용자 전환과 새로고침에서 반복하지 않습니다. 브라우저의 권한 철회·재요청은 운영체제 설정에 따릅니다.

## 실행

Node 24.21.0 이상 24.x:

```sh
npm start
```

http://localhost:4173 을 여세요. QR을 사용하지 않는 촬영·인쇄는 서버 저장소 없이 동작합니다.
로컬 QR 시험은 `.env.example`을 `.env`로 복사한 뒤, `KIOSK_SECRET`을 32자 이상의 무작위 값으로, `GALLERY_DIR`을 웹 공개 폴더 밖의 `.local-albums`로 설정하세요. 운영 코드는 처음 카메라 화면에서 입력합니다. localhost QR은 다른 휴대폰에서 열 수 없으므로 실제 행사는 HTTPS 배포가 필요합니다.

## Cloudflare 배포

**QR은 정적 파일 업로드만으로 동작하지 않습니다.** Pages Functions, 비공개 R2, 정기 삭제 Worker와 secret 설정이 필요합니다. [설정 가이드](docs/YONSEI-DEPLOYMENT.md)를 먼저 완료하세요. `wrangler.toml`의 버킷을 만들지 않고 배포하면 바인딩 오류가 날 수 있습니다.

## 검사

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
# 설치된 Chrome으로 검사할 때: PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

API 테스트: 운영 인증, Origin, 업로드 크기·형식, 만료·삭제.
브라우저 테스트: 베이직/특별 5가지 컷 조합, 8×5 카운트다운, 흑백, QR 9장 앨범, 인쇄 PDF, 권한 재사용, 모바일 가로 스크롤. 테스트는 가짜 카메라를 사용합니다. 실제 Safari·CP1500의 출력 검증을 대신하지 않습니다.

## 파일 구조

| 파일 | 역할 |
|---|---|
| dist/app.js | 단계 전환, 자동 촬영, 사진 선택·필터, 프레임 합성, QR, 인쇄 |
| dist/frames.json | 에디션·컷 수·프레임 파일·사진 슬롯 좌표 |
| dist/gallery.* | QR 사진 열람·다운로드 화면 |
| dist/vendor/qrcode.mjs | 외부 API 없이 QR 생성 (qrcode-generator 2.0.4, MIT) |
| lib/gallery.mjs | 인증, 앨범 API, 24시간 만료 검사, 삭제 |
| functions/api/[[path]].js | Cloudflare Pages Functions 진입점 |
| cleanup/worker.mjs | 10분 주기의 만료 사진 삭제 |
| server.mjs / lib/local-photos.mjs | 로컬 개발 서버와 파일 저장소 어댑터 |

QR 주소는 비밀번호와 같은 열람 권한입니다. 사진이 없어져도 수신자가 이미 저장한 사본은 회수할 수 없습니다. 기존 보안 보고서는 이전 커밋 기준이므로 새 QR 백엔드에 대한 완전한 보안 인증으로 해석하지 마세요.

## 2026-09-26 화면 및 QR 동의 개선

- 베이직/특별에디션 예시 사진과 연세스튜디오 SVG 로고를 반영했습니다.
- 종류 선택 화면의 연결 점검 버튼, 촬영 중 일시정지 버튼을 제거했습니다.
- 촬영시작 버튼은 간단한 문구만 표시합니다. 실제 촬영은 기존처럼 5초 × 8장입니다.
- QR로 사진 받기는 기본 해제이며, 선택하지 않으면 앨범 생성이나 사진 업로드가 일어나지 않습니다. 서버도 동의 정보 없이 생성하는 요청을 거부합니다.
- 브라우저가 백그라운드로 가거나 카메라가 끊긴 경우에는 안전하게 촬영을 중단하고, 복귀 후 남은 사진을 이어 찍을 수 있습니다.
- 운영 설정 재연결은 `/?setup=1` 주소를 사용합니다.
- 로고 원본과 재생성 방법: `branding/README-YONSEI.md`, `scripts/refresh-yonsei-logo.py`.
