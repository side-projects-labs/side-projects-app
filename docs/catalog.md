# 프로젝트 카탈로그

허브 앱의 목록은 `catalog/projects.json`이 원본이다. 앱 재빌드 없이 이 파일만 수정해 master에 병합하면 목록이 바뀐다.

## 동작
1. 앱 시작 시 번들본(빌드에 포함된 `catalog/projects.json`)으로 즉시 렌더한다.
2. 마지막으로 성공한 원격본(캐시)이 있으면 덮어쓴다.
3. 원격(`raw.githubusercontent.com/.../master/catalog/projects.json`)을 5초 제한으로 받아 검증을 통과하면 덮어쓰고 캐시한다. 실패하면 앞 단계 값을 유지한다.
4. 목록 화면을 아래로 당기면 다시 받는다. raw 응답은 CDN에 수 분간 캐시될 수 있다.

## 형식 (version 1)
`{ "version": 1, "projects": [{ "id", "name", "description", "icon", "url", "repo?" }] }`

- `id`: 레포 이름과 동일하게 쓴다. 푸시 이벤트의 `projectId`와 매칭된다. 중복 불가.
- `url`: 자격증명이 없는 **HTTPS**만 허용한다. 실제 응답을 확인한 주소만 넣는다. 레포 homepage 값은 오래될 수 있다.
- 검증에 실패한 항목은 건너뛰고, 쓸 수 있는 항목이 하나도 없으면 원격본 전체를 버린다. 최대 50개.

## 보안 메모
- 이 파일이 WebView로 열 주소를 결정하므로 master의 쓰기 권한이 곧 앱의 노출 범위다. 브랜치 보호와 PR 리뷰로 관리한다.
- 다른 주소로 바꾸려면 빌드 시 `EXPO_PUBLIC_CATALOG_URL`을 지정한다. 앱에 포함되는 공개 값이므로 비밀 값을 넣지 않는다.
