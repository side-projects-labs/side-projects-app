# 프로젝트 카탈로그

허브 앱의 목록은 `catalog/projects.json`이 원본이다. 앱 재빌드 없이 이 파일만 수정해 master에 병합하면 목록이 바뀐다.

## 동작
1. 앱 시작 시 번들본(빌드에 포함된 `catalog/projects.json`)으로 즉시 렌더한다.
2. 마지막으로 성공한 원격본(캐시)이 있으면 덮어쓴다.
3. 원격(`raw.githubusercontent.com/.../master/catalog/projects.json`)을 5초 제한으로 받아 검증을 통과하면 덮어쓰고 캐시한다. 실패하면 앞 단계 값을 유지한다.
4. 목록 화면을 아래로 당기면 다시 받는다. raw 응답은 CDN에 수 분간 캐시될 수 있다.

## 형식 (version 1)
`{ "version": 1, "projects": [{ "id", "name", "description", "icon", "url", "repo?", "allowedHosts?" }] }`

- `id`: 레포 이름과 동일하게 쓴다. 푸시 이벤트의 `projectId`와 매칭된다. 중복 불가.
- `url`: 자격증명이 없는 **HTTPS**만 허용한다. 실제 응답을 확인한 주소만 넣는다. 레포 homepage 값은 오래될 수 있다.
- 검증에 실패한 항목은 건너뛰고, 쓸 수 있는 항목이 하나도 없으면 원격본 전체를 버린다. 최대 50개.

## 소셜 로그인 (allowedHosts)
서비스가 GitHub·Google 등으로 로그인하면 로그인 도중 다른 호스트로 이동한다. 이 호스트가 WebView 허용 목록에 없으면 기기 브라우저로 열려, 로그인 세션이 앱 WebView로 돌아오지 않는다. 로그인 흐름에 쓰이는 호스트를 `allowedHosts`에 넣으면 WebView 안에서 끝까지 진행된다.
- 호스트 이름만 쓴다(HTTPS 전용, 와일드카드·포트·경로 불가). 최대 10개.
- 서비스 호스트는 항상 허용된다. 예: portfolio-admin은 `api.ycseng.com`(인증 시작·콜백), `github.com`, `accounts.google.com`.
- 이 필드는 앱 코드가 해석하므로 **새 앱 빌드를 설치해야** 적용된다. 이전 앱은 필드를 무시한다.
- Google은 임베디드 WebView에서의 OAuth를 막는 정책이 있어(`403 disallowed_useragent`) 허용해도 로그인이 거부될 수 있다.

## 보안 메모
- 이 파일이 WebView로 열 주소를 결정하므로 master의 쓰기 권한이 곧 앱의 노출 범위다. 브랜치 보호와 PR 리뷰로 관리한다.
- 다른 주소로 바꾸려면 빌드 시 `EXPO_PUBLIC_CATALOG_URL`을 지정한다. 앱에 포함되는 공개 값이므로 비밀 값을 넣지 않는다.
