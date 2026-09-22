# GitHub → Cloudflare Pages

## 첫 업로드

GitHub에서 빈 저장소를 만든 뒤, 이 폴더에서 실행합니다. ye-duri은 실제 계정명으로 바꿉니다. 공개 범위는 저장소 생성 시 선택합니다.

```sh
git add .
git diff --cached --stat
git commit -m "feat: initialize ASKIVE photo booth"
git remote add origin https://github.com/ye-duri/askive.git
git push -u origin main
```

인증은 GitHub의 로그인 도구 또는 SSH 설정을 사용합니다. 토큰을 소스나 remote URL에 넣지 않습니다. `git commit`에서 사용자 정보를 요구하면 본인의 이름과 GitHub 커밋용 이메일을 설정하세요.

## Pages 설정

Workers & Pages → Create application → Pages → Connect to Git에서 GitHub를 연결하고 해당 저장소를 선택합니다.

| 항목 | 값 |
|---|---|
| Production branch | main |
| Framework preset | None |
| Build command | 비워 두기 |
| Build output directory | dist |
| Root directory | 저장소 최상위, 비워 두기 |

Save and Deploy 후 실제 발급된 HTTPS 주소로 접속합니다. 서버용 `.env` 설정은 이번 정적 배포에 필요하지 않습니다. 업로드 방식으로 만든 기존 Pages 프로젝트는 새 Git 연동 프로젝트로 생성합니다.

공식 안내: https://developers.cloudflare.com/pages/get-started/git-integration/

## 업데이트

```sh
npm run check
npm test
git add .
git diff --cached
git commit -m "fix: describe the actual change"
git push
```

main에 push하면 Pages가 새 배포를 시작합니다. 배포 성공 상태와 실제 페이지를 확인하세요.

## 다른 컴퓨터

```sh
git clone https://github.com/ye-duri/askive.git
cd askive
npm start
```

이후 `git pull --ff-only`로 갱신합니다. 작업 중 변경이 있다면 먼저 정리하세요.

## 배포 후 확인

- Safari에서 카메라 허용과 10장 촬영
- 1·2·4·6컷 선택, 프레임·필터, 저장 결과
- 메시지 공유와 현장 프린터 출력
- 개인정보 문의 연락처와 이용 종료 기능

현재 문서는 배포 준비 가이드이며 실제 GitHub 업로드·Cloudflare 연결 완료를 뜻하지 않습니다.
